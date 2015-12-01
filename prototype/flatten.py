import yaml
import struct
import argh
import csv
import sys
import os
import six
from contextualized import contextualized_tracebacks
from collections import namedtuple

fields = ['cmenergies', 'reaction', 'observables', 'var_x', 'var_y', 'x_low', 'x_high', 'y']
Record = namedtuple('Record', fields)

"""
Format:

little endian
size_t is uint32

TableGroup {
    float cmenergies;
    string reaction;
    string observables;
    string var_x;
    string var_y;

    Record[] records;
}

Record {
    float x_low;
    float x_high;
    float y;
}
"""

class CustomBinaryWriter(object):
    def __init__(self, fp):
        self.fp = fp

        self.current_group = None
        self.count_records_in_group = None
        self.offset_group_size = None

    def size_format(self, number):
        return struct.pack('<I', number)

    def string_format(self, a_string):
        data = a_string.encode('UTF-8')
        return self.size_format(len(data)) + data

    def group_from_record(self, record):
        return record[:5]

    def record_pertains_current_group(self, record):
        return self.group_from_record(record) == self.current_group

    def write_record(self, record):
        assert isinstance(record, Record)

        if self.record_pertains_current_group(record):
            self.count_records_in_group += 1
            self.fp.write(struct.pack('<fff',
                record.x_low, record.x_high, record.y))
        else:
            self.finish_current_group()
            self.start_new_group(record)

    def finish_current_group(self):
        if self.current_group is not None:
            self.fp.seek(self.offset_group_size)
            self.fp.write(self.size_format(self.count_records_in_group))
            self.fp.seek(0, os.SEEK_END)

    def start_new_group(self, record):
        self.current_group = self.group_from_record(record)
        self.count_records_in_group = 0

        self.fp.write(struct.pack('<f', record.cmenergies))
        self.fp.write(self.string_format(record.reaction))
        self.fp.write(self.string_format(record.observables))
        self.fp.write(self.string_format(record.var_x))
        self.fp.write(self.string_format(record.var_y))

        # Write a zero length list length field, it will be updated later
        # with the number of records.
        self.offset_group_size = self.fp.tell()
        self.fp.write(self.size_format(0))

    def close(self):
        self.finish_current_group()

class NotNumeric(Exception):
    pass

def coerce_float(value):
    if type(value) == float:
        return value
    elif 'exp' in value:
        base = value.split(' ')[0]
        exp = value.split('exp')[-1]
        return float(base + 'e' + exp)
    else:
        raise NotNumeric(value)

def find_keyword(table, keyword):
    matches = [
        k for k in table['keywords']
        if k['name'] == keyword
    ]
    if len(matches) == 1:
        return matches[0]['values']
    elif len(matches) == 0:
        raise KeyError('No keyword ' + keyword)
    else:
        raise RuntimeError('Too many entries for keyword ' + keyword)

def find_qualifier(dep_var, name, allow_many=False):
    matches = [
        k for k in dep_var['qualifiers']
        if k['name'] == name
    ]
    if len(matches) == 0:
        raise KeyError('No qualifier ' + name)
    else:
        if allow_many:
            return [x['value'] for x in matches]
        elif len(matches) == 1 :
            return matches[0]['value']
        else:
            raise RuntimeError('Too many entries for qualifier ' + name)

def coerce_list(thing):
    assert isinstance(thing, list), (type(thing))
    return thing

def read_table(path, table):
    dcontext.table = filename = table['data_file']
    with open(os.path.join(path, filename)) as f:
        doc = yaml.safe_load(f)

    #reaction = find_keyword(table, 'reactions')
    #assert len(reaction) == 1, (path, table['data_file'])
    #reaction = reaction[0]
    try:
        observables = ', '.join(coerce_list(find_keyword(table, 'observables')))
    except KeyError:
        observables = 'unknown'

    try:
        # Only used if RE is not specified in the dependent variable
        default_reaction = find_keyword(table, 'reactions')[0]
    except KeyError:
        default_reaction = ''

    for indep_var in doc['independent_variables']:
        header = indep_var['header']
        if 'units' in header:
            var_x = '%s (%s)' % (header['name'], header['units'])
        else:
            var_x = header['name']
        x_values = indep_var['values']

        # If there are several independent_variables, each gets as many
        # registers as rows the table has.
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

            for i, val in enumerate(dep_var['values']):
                if val['value'] != '-':
                    if 'low' in x_values[i]:
                        x_low = x_values[i]['low']
                        x_high = x_values[i]['high']
                    else:
                        x_low = x_high = x_values[i]['value']

                    if isinstance(x_low, six.string_types) or \
                       isinstance(x_high, six.string_types):
                        continue #ignore this one...

                    try:
                        y = coerce_float(val['value'])
                    except NotNumeric:
                        continue

                    yield Record(
                        reaction=reaction,
                        cmenergies=cmenergies,
                        observables=observables,
                        var_x=var_x,
                        var_y=var_y,
                        x_low=x_low,
                        x_high=x_high,
                        y=y
                    )

    dcontext.table = None

def read_submission(path):
    with open(os.path.join(path, 'submission.yaml')) as f:
        submission = list(yaml.safe_load_all(f))

    header = submission[0]
    tables = submission[1:]
    for table in tables:
        yield from read_table(path, table)

def flatten_table(*filenames):
    csv_writer = csv.writer(sys.stdout)
    csv_writer.writerow(fields)

    for filename in filenames:
        for record in read_table(filename):
            csv_writer.writerow(record)

def flatten(*submission_directories):
    csv_writer = csv.writer(sys.stdout)
    csv_writer.writerow(fields)

    for dir in submission_directories:
        dcontext.submission = dir

        if '.zip' in dir:
            continue
        for record in read_submission(dir):
            csv_writer.writerow(record)

    print('Done', file=sys.stderr)


def to_binary(output_file, *submission_directories):
    fp = open(output_file, 'wb')
    writer = CustomBinaryWriter(fp)

    for dir in submission_directories:
        dcontext.submission = dir

        if '.zip' in dir:
            continue
        for record in read_submission(dir):
            writer.write_record(record)

    writer.close()
    fp.close()
    print('Done', file=sys.stderr)

with contextualized_tracebacks(['submission', 'table']) as dcontext:
    argh.dispatch_commands([flatten, to_binary])
