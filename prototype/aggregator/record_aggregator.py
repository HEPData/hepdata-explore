import os

import six
import yaml

from aggregator.harmonizing import coerce_list, find_keyword, find_qualifier, \
    coerce_float, NotNumeric, find_inspire_record
from aggregator.record_types import TableGroupMetadata, Record
from aggregator.record_writer import RecordWriter
from aggregator.variable_index import VariableIndex
from aggregator.shared_dcontext import dcontext


class RecordAggregator(object):
    def __init__(self, root_path):
        self.record_writers = {}  # RecordWriter's by dependent variable name
        self.root_path = root_path
        self.var_index = VariableIndex(root_path, 'variables.json')

    def process_submission(self, path):
        with open(os.path.join(path, 'submission.yaml')) as f:
            submission = list(yaml.safe_load_all(f))

        header = submission[0]
        tables = submission[1:]
        for table in tables:
            self.process_table(path, header, table)

    def process_table(self, submission_path, submission_header, table):
        """
        Stores values from a submission's table.

        :param submission_path: The path of the submission directory.
        :param submission_header: The dictionary describing the submission metadata.
        :param table: The dictionary describing the table metadata (as in submission.yaml)
        """
        dcontext.table = filename = table['data_file']
        with open(os.path.join(submission_path, filename)) as f:
            doc = yaml.safe_load(f)

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

                try:
                    reaction = find_qualifier(dep_var, 'RE', allow_many=True)[0]
                except KeyError:
                    reaction = default_reaction

                record_writer = self.get_record_writer(var_x)
                table_group_metadata = TableGroupMetadata(
                        inspire_record=inspire_record,
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
        assert(isinstance(dependent_variable, str))
        if dependent_variable in self.record_writers.keys():
            return self.record_writers[dependent_variable]
        else:
            directory = self.var_index.get_var_directory(dependent_variable)
            record_writer = RecordWriter(directory)
            self.record_writers[dependent_variable] = record_writer
            return record_writer
