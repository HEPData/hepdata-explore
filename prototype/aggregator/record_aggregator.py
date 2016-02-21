import os

import six
import yaml

from aggregator.harmonizing import coerce_list, find_keyword, find_qualifier, \
    coerce_float, NotNumeric, find_inspire_record
from aggregator.shared_dcontext import dcontext
from elasticsearch import Elasticsearch

try:
    from yaml import CSafeLoader as SafeLoader
except ImportError:
    print("WARNING: Using Python YAML loader, which is very slow. Please build PyYAML with C extensions.")
    from yaml import SafeLoader


def clean_cmenergies(cmenergies):
    if isinstance(cmenergies, int):
        cmenergies = float(cmenergies)
    if isinstance(cmenergies, float):
        return [cmenergies, cmenergies]  # only one data point
    elif isinstance(cmenergies, str):
        cmenergies = cmenergies.strip()

        if cmenergies.endswith(' GeV'):
            cmenergies = cmenergies.replace(' GeV', '')

        if '-' in cmenergies[1:]:  # '-' appears in any position except the first (it would be a minus symbol then)
            # cmenergies is a range
            cmenergies = [
                float(n)
                for n in cmenergies.rsplit('-', 1)
                ]
            assert (len(cmenergies) == 2)
            return cmenergies
        else:
            # cmenergies is just a data point
            cmenergies = [float(cmenergies), float(cmenergies)]
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
            raise RuntimeError('Invalid format for error value string: %s' % value)
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
            plus = clean_error_value(y, error['symerror'])
            minus = -plus

        ret.append({
            'label': label,
            'plus': plus,
            'minus': minus,
        })
    return ret


class RecordAggregator(object):
    def __init__(self, index, **elastic_args):
        self.elastic = Elasticsearch(**elastic_args)
        self.index = index
        self.init_mapping()

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
            new_table = self.process_table(path, header, table)
            processed_tables.append(new_table)

        publication['tables'] = processed_tables
        self.write_publication(publication)

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

        table = dict(
                table_num=table_num,
                observables=observables,
                description=table['description'],
        )
        table_groups = []

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
                    cmenergies = find_qualifier(dep_var, 'SQRT(S)/NUCLEON')
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

                cmenergies = clean_cmenergies(cmenergies)

                try:
                    reaction = find_qualifier(dep_var, 'RE', allow_many=True)[0]
                except KeyError:
                    reaction = default_reaction

                table_group = dict(
                        reaction=reaction,
                        cmenergies=cmenergies,
                        var_x=var_x,
                        var_y=var_y,
                )
                data_points = []

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

                        data_points.append(dict(
                                x_low=x_low,
                                x_high=x_high,
                                y=y,
                                errors=clean_errors(y, val.get('errors', []))
                        ))

                if len(data_points) > 0:
                    table_group['data_points'] = data_points
                    table_groups.append(table_group)

        table['groups'] = table_groups
        dcontext.table = None
        return table

    def write_publication(self, publication):
        self.elastic.update(self.index, 'publication', publication['inspire_record'], {
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
                "groups": [{
                    "var_x": "time",
                    "var_y": "speed",
                    "data_points": [
                        {"x_low": 1, "y": 10},
                        {"x_low": 2, "y": 11},
                    ]
                }]
            }, {
                "table_num": 2,
                "description": "Acceleration",
                "groups": [{
                    "var_x": "time",
                    "var_y": "acceleration",
                    "data_points": [
                        {"x_low": 1, "y": 5},
                        {"x_low": 2, "y": 5},
                        {"x_low": 3, "y": 5},
                        {"x_low": 4, "y": 4},
                    ]
                }]
            }]
        })

        self.write_publication({
            "comment": "Publication B",
            "inspire_record": 2,
            "tables": [{
                "table_num": 1,
                "description": "Speed",
                "groups": [{
                    "var_x": "time",
                    "var_y": "distance",
                    "data_points": [
                        {"x_low": 1, "y": 100},
                        {"x_low": 2, "y": 110},
                    ]
                }]
            }, {
                "table_num": 2,
                "description": "Acceleration",
                "groups": [{
                    "var_x": "time",
                    "var_y": "speed",
                    "data_points": [
                        {"x_low": 1, "y": 50},
                        {"x_low": 2, "y": 40},
                        {"x_low": 3, "y": 50},
                        {"x_low": 4, "y": 40},
                    ]
                }]
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
                                "description": {"type": "string"},
                                "groups": {
                                    "type": "nested",
                                    "properties": {
                                        "cmenergies": {"type": "double"},
                                        "reaction": {"type": "string", "index": "not_analyzed"},
                                        "data_points": {
                                            "type": "nested",
                                            "properties": {
                                                "errors": {
                                                    "properties": {
                                                        "label": {"type": "string", "index": "not_analyzed"},
                                                        "minus": {"type": "double"},
                                                        "plus": {"type": "double"}
                                                    }
                                                },
                                                "x_high": {"type": "double"},
                                                "x_low": {"type": "double"},
                                                "y": {"type": "double"}
                                            }
                                        },
                                        "var_x": {"type": "string", "index": "not_analyzed"},
                                        "var_y": {"type": "string", "index": "not_analyzed"}
                                    }
                                },
                                "observables": {"type": "string"},
                                "table_num": {"type": "long"}
                            }
                        }
                    }
                }
            }
        })
