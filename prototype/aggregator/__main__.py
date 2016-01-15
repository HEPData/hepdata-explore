from __future__ import print_function
import sys

import argh
from contextualized import contextualized_tracebacks

from aggregator import shared_dcontext

"""
Format:

little endian
size_t is varint

string {
    varint length;
    byte[length] contents;

    @interpret content as UTF-8
}

T[] {
    varint length;
    T* items;
}

Document {
    TableGroup[@eof-delimited];
}

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
    Error[] errors;
}

Error {
    varint error_label;
    float error_minus;
    float error_plus;
}
"""


def to_binary(output_path, *submission_directories):
    from aggregator.record_aggregator import RecordAggregator
    record_aggregator = RecordAggregator(output_path)

    for directory in submission_directories:
        dcontext.submission = directory

        if '.zip' in directory:
            continue
        record_aggregator.process_submission(directory)

    print('Done', file=sys.stderr)


if __name__ == "__main__":
    with contextualized_tracebacks(['submission', 'table', 'reading_file']) as dcontext:
        shared_dcontext.dcontext = dcontext
        argh.dispatch_commands([to_binary])
