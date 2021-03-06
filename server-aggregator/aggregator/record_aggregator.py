import json
import os
from itertools import chain

import yaml

from aggregator.harmonizing import find_keyword, find_qualifier, \
    coerce_float, NotNumeric, find_inspire_record, ensure_list, \
    coerce_float_or_null, value_is_actually_a_range, parse_value_range
from aggregator.shared_dcontext import dcontext
from elasticsearch import Elasticsearch
import re

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
            percentage = float(value[:-1]) / 100
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
            ret.append({
                'type': 'asymerror',
                'label': label,
                'plus': plus,
                'minus': minus,
            })
        elif 'symerror' in error:
            value = clean_error_value(y, error['symerror'])
            ret.append({
                'type': 'symerror',
                'label': label,
                'value': value,
            })
    return ret


def cut_text(text):
    if text is not None:
        # Some descriptions are absurdly long, enough to make ElasticSearch
        # reject them
        return text[:2048]


def lower_or_null(text):
    if text is not None:
        return text.lower()


def extract_variable_name(header):
    if 'units' in header and header['units'].strip() != '':
        return '%s [%s]' % (header['name'], header['units'])
    else:
        return header['name']


class RejectedTable(Exception):
    @property
    def reason(self):
        return self.args[0]


def format_exception(ex):
    return '%s: %s' % (type(ex).__name__, ex)


re_arrow = re.compile(r' *-+> *')

def analyze_reactions(reactions):
    ret = []
    for string_full in reactions:
        if '->' not in string_full:
            print('Reaction without arrow in %s, %s. Value: %s' %
                  (dcontext.submission, dcontext.table, string_full))
            ret.append({
                'string_full': string_full,
                'string_in': None,
                'string_out': None,
                'particles_in': [],
                'particles_out': [],
            })
        else:
            reaction_stages = [x.strip() for x in re_arrow.split(string_full)]
            # Usually there are two reaction stages, but sometimes there are more
            string_in, string_out = reaction_stages[0], reaction_stages[-1]
            particles_in = string_in.split(' ')
            particles_out = string_out.split(' ')
            ret.append({
                'string_full': string_full,
                'string_in': string_in,
                'string_out': string_out,
                'particles_in': particles_in,
                'particles_out': particles_out,
            })
    return ret


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

        with open(os.path.join(path, 'publication.json')) as f:
            publication_meta = json.load(f)

        header = submission[0]
        tables = submission[1:]

        inspire_record = find_inspire_record(header)
        publication = dict(
            inspire_record=inspire_record,
            hepdata_doi=publication_meta['record']['hepdata_doi'],
            version=publication_meta['version'],
            collaborations=publication_meta['record']['collaborations'],
            # All of these may be None
            title=publication_meta['record']['title'],
            title_not_analyzed=lower_or_null(publication_meta['record'].get('title')),
            publication_date=publication_meta['record'].get('publication_date'),
            comment=cut_text(header['comment']),
            comment_not_analyzed=cut_text(lower_or_null(header['comment'])),
        )

        processed_tables = []
        for table in tables:
            try:
                new_table = self.process_table(path, header, publication_meta, table)
                processed_tables.append(new_table)
            except RejectedTable as err:
                print('Warning: Rejected table. ins%s, %s. Reason: %s' %
                      (inspire_record, table['name'], err.reason))
                self.count_tables_rejected += 1
            self.count_tables_total += 1

        publication['tables'] = processed_tables
        self.write_publication(publication)
        self.count_submissions += 1

    def process_table(self, submission_path, submission_header,
                      publication_meta, table):
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
        reactions = analyze_reactions(ensure_list(find_keyword(table, 'reactions')))

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
            description_not_analyzed=table['description'].lower(),

            cmenergies_min=cmenergies_min,
            cmenergies_max=cmenergies_max,
            reactions=reactions,
            reactions_full=[r['string_full'] for r in reactions],
            observables=observables,
            phrases=phrases,

            collaborations=publication_meta['record']['collaborations'],

            indep_vars=indep_var_meta,
            dep_vars=dep_var_meta,

            data_points=data_points
        )

        dcontext.table = None
        return table

    def write_publication(self, publication):
        with open('/tmp/pub.json', 'w') as f:
            f.write(json.dumps(publication))
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
                        "title": {"type": "string"},
                        "title_not_analyzed": {"type": "string","index": "not_analyzed"},
                        "comment": {"type": "string"},
                        "comment_not_analyzed": {"type": "string","index": "not_analyzed"},
                        "collaborations": {"type": "string","index": "not_analyzed"},
                        "publication_date": {"type": "date", "format": "strict_date_optional_time"},
                        "inspire_record": {"type": "long"},
                        "version": {"type": "long"},
                        "hepdata_doi": {"type": "string","index": "not_analyzed"},
                        "tables": {
                            "type": "nested",
                            "properties": {
                                "table_num": {"type": "long"},
                                "description": {"type": "string"},
                                "description_not_analyzed": {"type": "string","index": "not_analyzed"},

                                "cmenergies_min": {"type": "double"},
                                "cmenergies_max": {"type": "double"},
                                "reactions": {
                                    "type": "nested",
                                    "properties": {
                                        "string_full": {"type": "string","index": "not_analyzed"},
                                        "string_in": {"type": "string","index": "not_analyzed"},
                                        "string_out": {"type": "string","index": "not_analyzed"},
                                        "particles_in": {"type": "string","index": "not_analyzed"},
                                        "particles_out": {"type": "string","index": "not_analyzed"},
                                    }
                                },

                                "collaborations": {"type": "string","index": "not_analyzed"},  # denormalization
                                "reactions_full": {"type": "string","index": "not_analyzed"},  # denormalization

                                "observables": {"type": "string","index": "not_analyzed"},
                                "phrases": {"type": "string","index": "not_analyzed"},

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
                                            "type": "object",  # TODO should use nested to allow filtering by qualifier
                                            "properties": {
                                                "name": {"type": "string","index": "not_analyzed"},
                                                "value": {"type": "string","index": "not_analyzed"},
                                            }
                                        },
                                    },
                                },

                                "data_points": {"type": "object", "enabled": False},
                            }
                        }
                    }
                }
            }
        })
