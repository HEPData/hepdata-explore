import os
from itertools import chain

import yaml

from aggregator.harmonizing import find_keyword, find_qualifier, \
    coerce_float, NotNumeric, find_inspire_record, ensure_list, \
    coerce_float_or_null, value_is_actually_a_range, parse_value_range
from aggregator.shared_dcontext import dcontext
from elasticsearch import Elasticsearch

try:
    from yaml import CSafeLoader as SafeLoader
except ImportError:
    print("WARNING: Using Python YAML loader, which is very slow. "
          "Please build PyYAML with C extensions.")
    from yaml import SafeLoader


def clean_cmenergies(cmenergies):
    if isinstance(cmenergies, int):
        cmenergies = float(cmenergies)
    if isinstance(cmenergies, float):
        return (cmenergies, cmenergies)  # only one data point
    elif isinstance(cmenergies, str):
        cmenergies = cmenergies.strip()

        if cmenergies.endswith(' GeV'):
            cmenergies = cmenergies.replace(' GeV', '')

        if '-' in cmenergies[1:]:  # '-' appears in any position except the first (it would be a minus symbol then)
            # cmenergies is a range
            cmenergies = tuple(
                float(n)
                for n in cmenergies.rsplit('-', 1)
            )
            assert (len(cmenergies) == 2)
            return cmenergies
        else:
            # cmenergies is just a data point
            cmenergies = (float(cmenergies), float(cmenergies))
            return cmenergies
    else:
        raise RuntimeError('Invalid type for cmenergies: %s' % type(cmenergies))


def clean_error_value(y, value):
    if isinstance(value, (int, float)):
        return value
    elif isinstance(value, str):
        if value.endswith('%'):
            percentage = float(value[:-1])
            return y * percentage
        elif 'e' in value.lower():
            return float(value)  # scientific notation
        else:
            raise RuntimeError(
                'Invalid format for error value string: %s' % value)
    else:
        raise RuntimeError('Invalid type for error value: %s' % type(value))


def clean_errors(y, errors):
    ret = []
    for error in errors:
        label = error.get('label') or 'main'

        if 'asymerror' in error:
            plus = clean_error_value(y, error['asymerror']['plus'])
            minus = clean_error_value(y, error['asymerror']['minus'])
        elif 'symerror' in error:
            plus = minus = clean_error_value(y, error['symerror'])

        ret.append({
            'label': label,
            'plus': plus,
            'minus': minus,
        })
    return ret


def extract_variable_name(header):
    if 'units' in header and header['units'].strip() != '':
        return '%s (%s)' % (header['name'], header['units'])
    else:
        return header['name']


class RejectedTable(Exception):
    @property
    def reason(self):
        return self.args[0]


def format_exception(ex):
    return '%s: %s' % (type(ex).__name__, ex)


class RecordAggregator(object):
    def __init__(self, index, **elastic_args):
        self.elastic = Elasticsearch(timeout=180, **elastic_args)
        self.index = index
        self.count_submissions = 0
        self.count_tables_total = 0
        self.count_tables_rejected = 0
        self.init_mapping()

    def report_statistics(self):
        print('Indexed %d submissions.' % self.count_submissions)
        print('Scanned %d tables, rejected %d tables (%.2f%%).' %
              (self.count_tables_total, self.count_tables_rejected,
               100 * (self.count_tables_rejected / self.count_tables_total)))

    def process_submission(self, path):
        with open(os.path.join(path, 'submission.yaml')) as f:
            submission = list(yaml.load_all(f, Loader=SafeLoader))

        header = submission[0]
        tables = submission[1:]

        inspire_record = find_inspire_record(header)
        publication = dict(
            inspire_record=inspire_record,
            comment=header['comment'],
        )

        processed_tables = []
        for table in tables:
            try:
                new_table = self.process_table(path, header, table)
                processed_tables.append(new_table)
            except RejectedTable as err:
                print('Warning: Rejected table. ins%s, %s. Reason: %s' %
                      (inspire_record, table['name'], err.reason))
                self.count_tables_rejected += 1
            self.count_tables_total += 1

        publication['tables'] = processed_tables
        self.write_publication(publication)
        self.count_submissions += 1

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
            # Holds the parsed contents of the table file (e.g. Table1.yaml)
            doc = yaml.load(f, Loader=SafeLoader)

        cmenergies_raw = find_keyword(table, 'cmenergies')
        if len(cmenergies_raw) > 0:
            assert len(cmenergies_raw) == 1
            cmenergies_min, cmenergies_max = clean_cmenergies(cmenergies_raw[0])
        else:
            cmenergies_min = cmenergies_max = None

        observables = ensure_list(find_keyword(table, 'observables'))
        phrases   = ensure_list(find_keyword(table, 'phrases'))
        reactions = ensure_list(find_keyword(table, 'reactions'))

        indep_var_meta = [
            {'name': extract_variable_name(var['header'])}
            for var in doc['independent_variables']
        ]
        dep_var_meta = [
            {
                'name': extract_variable_name(var['header']),
                'qualifiers': var.get('qualifiers', []),
            }
            for var in doc['dependent_variables']
        ]

        # Reject this table if any variable has empty name
        for var_meta in chain(indep_var_meta, dep_var_meta):
            if var_meta['name'] == '':
                raise RejectedTable('Variable with empty name.')

        indep_var_values = (var['values']
                            for var in doc['independent_variables'])
        dep_var_values = (var['values']
                          for var in doc['dependent_variables'])

        # This spell extracts a table of values, with one column per variable.
        # Independent variables go first, then dependent variables.
        data_points = list(zip(*chain(indep_var_values, dep_var_values)))

        # A bit of validation and cleaning never hurts...
        excluded_indep_vars = set()
        excluded_indep_vars_reason = {}
        excluded_dep_vars = set()
        excluded_dep_vars_reason = {}

        # For each row...
        for data_point in data_points:
            indep_var_cols = data_point[:len(indep_var_meta)]
            dep_var_cols = data_point[len(indep_var_meta):]

            # Only for independent variables...
            for col, value in enumerate(indep_var_cols):
                assert 'value' in value or \
                       ('low' in value and 'high' in value)

                # Clean the data (handle infinity, scientific notation and so on)
                if 'value' in value:
                    if value_is_actually_a_range(value['value']):
                        center, plus_minus = parse_value_range(value['value'])
                        value['low'] = center - plus_minus
                        value['high'] = center + plus_minus
                        del value['value']

                    try:
                        # Note: nulls are allowed in dependent variables, but
                        # not in independent ones.
                        value['value'] = coerce_float(value['value'])
                    except NotNumeric as err:
                        excluded_indep_vars.add(col)
                        excluded_indep_vars_reason.setdefault(col, err)
                        continue

                if 'low' in value:
                    value['low'] = coerce_float(value['low'])
                    value['high'] = coerce_float(value['high'])

            # Only for dependent variables...
            for col, value in enumerate(dep_var_cols):
                assert 'value' in value, value

                if value_is_actually_a_range(value['value']):
                    center, plus_minus = parse_value_range(value['value'])
                    value['value'] = center
                    value.setdefault('errors', []).append({
                        'label': '_pm',
                        'symerror': plus_minus,
                    })

                try:
                    value['value'] = coerce_float_or_null(value['value'])
                except NotNumeric as err:
                    excluded_dep_vars.add(col)
                    excluded_dep_vars_reason.setdefault(col, err)
                    continue

                value['errors'] = clean_errors(value['value'],
                                               value.get('errors', []))

        # Some variables may have been excluded (e.g. because they contain non
        # numeric data). Warn and remove them.

        for index in excluded_indep_vars:
            var_name = indep_var_meta[index]['name']
            print('Warning: Excluded independent variable "%s" on %s, %s. Reason: %s' %
                  (var_name, dcontext.submission, dcontext.table,
                   format_exception(excluded_indep_vars_reason[index])))
        for index in excluded_dep_vars:
            var_name = dep_var_meta[index]['name']
            print('Warning: Excluded dependent variable "%s" on %s, %s. Reason: %s' %
                  (var_name, dcontext.submission, dcontext.table,
                   format_exception(excluded_dep_vars_reason[index])))

        excluded_cols = excluded_indep_vars.union({
            col_number + len(indep_var_meta)
            for col_number in excluded_dep_vars
        })
        indep_var_meta = [
            x for i, x in enumerate(indep_var_meta)
            if i not in excluded_indep_vars
        ]
        dep_var_meta = [
            x for i, x in enumerate(dep_var_meta)
            if i not in excluded_dep_vars
        ]
        data_points = [
            tuple(
                x for i, x in enumerate(row)
                if i not in excluded_cols
            )
            for row in data_points
        ]

        if len(indep_var_meta) == 0:
            raise RejectedTable('No valid independent variables.')
        if len(dep_var_meta) == 0:
            raise RejectedTable('No valid dependent variables.')

        table = dict(
            table_num=table_num,
            description=table['description'],

            cmenergies_min=cmenergies_min,
            cmenergies_max=cmenergies_max,
            reactions=reactions,
            observables=observables,
            phrases=phrases,

            indep_vars=indep_var_meta,
            dep_vars=dep_var_meta,

            data_points=data_points
        )

        dcontext.table = None
        return table

    def write_publication(self, publication):
        self.elastic.update(self.index, 'publication',
                            publication['inspire_record'], {
                                'doc': publication,
                                'doc_as_upsert': True,
                            })

    def load_mini_demo(self):
        self.write_publication({
            "comment": "Publication A",
            "inspire_record": 1,
            "tables": [{
                "table_num": 1,
                "description": "Speed",
                "indep_vars": ["time"],
                "dep_vars": ["speed"],
                "data_points": [{
                    # [time, speed]
                    [{"low": 0.9, "high": 1.1}, {"value": 10}],
                    [{"low": 1.9, "high": 2.1}, {"value": 11}],
                }],
            }, {
                "table_num": 2,
                "description": "Acceleration",
                "indep_vars": ["time"],
                "dep_vars": ["speed", "acceleration"],
                "qualifiers": [
                    [{"type": "RE", "value": "TEST"}],
                    [{"type": "RE", "value": "TEST"}],
                ],
                "data_points": [
                    # [time, speed, acceleration]
                    [{"value": 1}, {"value": 0}, {"value": 5}],
                    [{"value": 2}, {"value": 0}, {"value": 5}],
                    [{"value": 3}, {"value": 0}, {"value": 5}],
                    [{"value": 4}, {"value": 0}, {"value": 4}],
                ]
            }]
        })

        self.write_publication({
            "comment": "Publication B",
            "inspire_record": 2,
            "tables": [{
                "table_num": 1,
                "description": "Speed",
                "indep_vars": ["time"],
                "dep_vars": ["distance"],
                "data_points": [{
                    # [time, distance]
                    [{"low": 0.9, "high": 1.1}, {"value": 10}],
                    [{"low": 1.9, "high": 2.1}, {"value": 11}],
                }],
            }, {
                "table_num": 2,
                "description": "Acceleration",
                "indep_vars": ["time"],
                "dep_vars": ["speed"],
                "data_points": [
                    # [time, speed]
                    [{"value": 1}, {"value": 50}],
                    [{"value": 2}, {"value": 40}],
                    [{"value": 3}, {"value": 50}],
                    [{"value": 4}, {"value": 40}],
                ],
            }]
        })

    def init_mapping(self):
        if self.elastic.indices.exists(self.index):
            return

        self.elastic.indices.create(self.index, {
            "mappings": {
                "publication": {
                    "properties": {
                        "comment": {"type": "string"},
                        "inspire_record": {"type": "long"},
                        "tables": {
                            "type": "nested",
                            "properties": {
                                "table_num": {"type": "long"},
                                "description": {"type": "string"},

                                "cmenergies_min": {"type": "double"},
                                "cmenergies_max": {"type": "double"},
                                "reactions": {"type": "string","index": "not_analyzed"},
                                "observables": {"type": "string"},
                                "phrases": {"type": "string"},

                                "indep_vars": {
                                    "type": "object",
                                    "properties": {
                                        "name": {"type": "string","index": "not_analyzed"},
                                    }
                                },
                                "dep_vars": {
                                    "type": "object",
                                    "properties": {
                                        "name": {"type": "string","index": "not_analyzed"},
                                        "qualifiers": {
                                            "type": "object",
                                            "properties": {
                                                "name": {"type": "string","index": "not_analyzed"},
                                                "value": {"type": "string","index": "not_analyzed"},
                                            }
                                        },
                                    },
                                },

                                # "data_points": {"type": "object", "enabled": False},
                            }
                        }
                    }
                }
            }
        })
