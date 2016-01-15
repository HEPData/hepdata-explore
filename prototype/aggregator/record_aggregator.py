import os

import six
import yaml

from aggregator.harmonizing import coerce_list, find_keyword, find_qualifier, \
    coerce_float, NotNumeric, find_inspire_record
from aggregator.lru_cache import LRUCache
from aggregator.record_types import TableGroupMetadata, Record
from aggregator.record_writer import RecordWriter
from aggregator.string_set_store import StringSetStore
from aggregator.transactions import Transaction, in_transaction
from aggregator.variable_index import VariableIndex
from aggregator.shared_dcontext import dcontext

try:
    from yaml import CSafeLoader as SafeLoader
except ImportError:
    print("WARNING: Using Python YAML loader, which is very slow. Please build PyYAML with C extensions.")
    from yaml import SafeLoader


class RecordAggregator(object):
    def __init__(self, root_path):
        self.root_path = root_path

        # Index RecordWriter's by dependent variable name
        self.record_writers_cache = LRUCache(self.construct_record_writer, capacity=100)
        self.var_index = VariableIndex(root_path, 'variables.json')
        self.existing_submissions = StringSetStore(os.path.join(root_path, 'submissions.txt'))

    def construct_record_writer(self, dependent_variable):
        directory = self.var_index.get_var_directory(dependent_variable)
        record_writer = RecordWriter(directory)
        return record_writer

    def process_submission(self, path):
        with open(os.path.join(path, 'submission.yaml')) as f:
            submission = list(yaml.load_all(f, Loader=SafeLoader))

        header = submission[0]
        submission_id = 'ins%d' % find_inspire_record(header)
        tables = submission[1:]

        if submission_id not in self.existing_submissions:
            # We use a transaction so all writes are only performed when the block with exits.
            # This way a submission is entirely stored or not stored at all, but never is stored partially in case a
            # format error occurs meanwhile (e.g. in Table2 after Table1 has been written).
            with in_transaction():
                for table in tables:
                    self.process_table(path, header, table)

                # Add the submission to existing_submissions so it is not processed next time
                self.existing_submissions.add_string(submission_id)

            # Exiting the with block commits the transaction
        else:
            print('Warning: Skipping already existing submission %s (%s)' % (submission_id, path))

    def process_table(self, submission_path, submission_header, table):
        """
        Stores values from a submission's table.

        :param submission_path: The path of the submission directory.
        :param submission_header: The dictionary describing the submission metadata.
        :param table: The dictionary describing the table metadata (as in submission.yaml)
        """
        dcontext.table = filename = table['data_file']

        table_num = int(table['name'].replace('Table ', ''))

        with open(os.path.join(submission_path, filename)) as f:
            doc = yaml.load(f, Loader=SafeLoader)

        try:
            observables = ', '.join(coerce_list(find_keyword(table, 'observables')))
        except KeyError:
            observables = 'unknown'

        try:
            # Only used if RE is not specified in the dependent variable
            default_reaction = find_keyword(table, 'reactions')[0]
        except KeyError:
            default_reaction = ''

        inspire_record = find_inspire_record(submission_header)

        for indep_var in doc['independent_variables']:
            header = indep_var['header']
            if 'units' in header:
                var_x = '%s (%s)' % (header['name'], header['units'])
            else:
                var_x = header['name']
            x_values = indep_var['values']

            # If there are several independent_variables, each gets as many
            # records as rows the table has.
            for dep_var in doc['dependent_variables']:
                var_y = dep_var['header']['name']

                try:
                    cmenergies = float(find_qualifier(dep_var, 'SQRT(S)/NUCLEON'))
                except KeyError:
                    # Use keyword data instead
                    try:
                        cmenergies = find_keyword(table, 'cmenergies')
                        assert isinstance(cmenergies, list)
                        assert len(cmenergies) == 1
                        cmenergies = cmenergies[0]
                    except KeyError:
                        # Last resort...
                        cmenergies = 0

                    if isinstance(cmenergies, str):
                        print("Warning: Invalid cmenergies: (%s, %s) %s" %
                              (dcontext.submission, dcontext.table, cmenergies))
                        cmenergies = 0

                try:
                    reaction = find_qualifier(dep_var, 'RE', allow_many=True)[0]
                except KeyError:
                    reaction = default_reaction

                record_writer = self.get_record_writer(var_x)
                table_group_metadata = TableGroupMetadata(
                        inspire_record=inspire_record,
                        table_num=table_num,
                        reaction=reaction,
                        cmenergies=cmenergies,
                        observables=observables,
                        var_x=var_x,
                        var_y=var_y,
                )
                records = []

                for i, val in enumerate(dep_var['values']):
                    if val['value'] != '-':
                        if 'low' in x_values[i]:
                            x_low = x_values[i]['low']
                            x_high = x_values[i]['high']
                        else:
                            x_low = x_high = x_values[i]['value']

                        if isinstance(x_low, six.string_types) or \
                                isinstance(x_high, six.string_types):
                            continue  # ignore this one...

                        try:
                            y = coerce_float(val['value'])
                        except NotNumeric:
                            continue

                        records.append(Record(
                                x_low=x_low,
                                x_high=x_high,
                                y=y,
                                errors=val.get('errors', [])
                        ))

                record_writer.write_table_group(table_group_metadata, records)
                self.var_index.update_record_count(var_x, len(records))

        dcontext.table = None

    def get_record_writer(self, dependent_variable):
        assert (isinstance(dependent_variable, str))
        return self.record_writers_cache.get(dependent_variable)
