from __future__ import print_function

import os
import sys

import argh
from contextualized import contextualized_tracebacks

from aggregator import shared_dcontext
from progressbar import ProgressBar, Percentage, Bar, Widget

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


class Label(Widget):
    """Displays an updatable label."""

    def __init__(self, min_length=0, starting_text=''):
        self.min_length = min_length
        self.change_text(starting_text)

    def change_text(self, text):
        self.text = text.ljust(self.min_length)

    def update(self, pbar):
        return ' ' + self.text + ' '


class AlwaysUpdatingProgressBar(ProgressBar):
    def _need_update(self):
        return True


def to_binary(output_path, *submission_directories):
    from aggregator.record_aggregator import RecordAggregator
    record_aggregator = RecordAggregator(output_path)

    submission_directories = [
        directory for directory
        in submission_directories
        if '.zip' not in directory
        ]

    submission_label = Label(min_length=10)
    pbar = AlwaysUpdatingProgressBar(maxval=len(submission_directories),
                                     widgets=[
                                         Percentage(),
                                         submission_label,
                                         Bar(marker='#', left='[', right=']')
                                     ]).start()
    for i, directory in enumerate(submission_directories):
        dcontext.submission = directory
        submission_label.change_text(os.path.basename(directory))
        pbar.update(i)

        record_aggregator.process_submission(directory)
    pbar.finish()
    print('Done', file=sys.stderr)


if __name__ == "__main__":
    with contextualized_tracebacks(['submission', 'table', 'reading_file']) as dcontext:
        shared_dcontext.dcontext = dcontext
        argh.dispatch_commands([to_binary])
