import os
import struct

from aggregator.string_dictionary import StringDictionary
from aggregator.binary_formats import size_format, string_format, varint_format
from aggregator.record_types import Record
from aggregator.transactions import get_current_transaction


def error_to_float(value, error_value):
    if isinstance(error_value, float):
        return error_value
    elif error_value.endswith('%'):
        percentage = float(error_value[:-1])
        return value * percentage
    else:
        try:
            return float(error_value)
        except:
            raise RuntimeError('Invalid error: ' + error_value)


class RecordWriter(object):
    def __init__(self, dependent_variable_dir):
        self.path = dependent_variable_dir
        self.fp_records = open(os.path.join(self.path, 'records.bin'), 'a+b')
        self.string_dict = StringDictionary(os.path.join(self.path, 'strings.txt'))
        self.closed = False

    def close(self):
        assert (not self.closed)
        t = get_current_transaction()
        t.close(self.fp_records)
        self.string_dict.close()
        self.closed = True

    def write_table_group(self, metadata, records):
        self.write_group_header(metadata, len(records))
        for record in records:
            self.write_record(record)

    def write_group_header(self, metadata, num_records):
        t = get_current_transaction()

        t.write(self.fp_records, varint_format(metadata.inspire_record))
        t.write(self.fp_records, varint_format(metadata.table_num))
        t.write(self.fp_records, struct.pack('<ff', *metadata.cmenergies))
        t.write(self.fp_records, string_format(metadata.reaction))
        t.write(self.fp_records, string_format(metadata.observables))
        t.write(self.fp_records, string_format(metadata.var_y))

        t.write(self.fp_records, size_format(num_records))

    def write_record(self, record):
        assert isinstance(record, Record)
        t = get_current_transaction()
        t.write(self.fp_records, struct.pack('<fff', record.x_low, record.x_high, record.y))
        self.write_errors(record.y, record.errors)

    def write_errors(self, value, errors):
        """
        // Writes Error[]

        T[] {
            varint length;
            T* items;
        }

        Error {
            varint error_label;
            float error_minus;
            float error_plus;
        }
        """

        t = get_current_transaction()
        t.write(self.fp_records, varint_format(len(errors)))
        for error in errors:
            error_label_str = error.get('label', '')

            if 'asymerror' in error:
                error_minus = error_to_float(value, error['asymerror']['minus'])
                error_plus = error_to_float(value, error['asymerror']['plus'])
            else:
                error_minus = error_plus = error_to_float(value, error['symerror'])

            error_label = self.string_dict.id_for_str(error_label_str)
            t.write(self.fp_records, varint_format(error_label))
            t.write(self.fp_records, struct.pack('<ff',
                                                 error_minus, error_plus))


record_writers = {}


def get_record_writer(dependent_variable):
    if dependent_variable in record_writers.keys():
        return record_writers[dependent_variable]
    else:
        record_writer = RecordWriter(dependent_variable)
        record_writers[dependent_variable] = record_writer
        return record_writer
