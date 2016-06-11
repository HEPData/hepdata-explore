from __future__ import print_function

import os
import sys

import argh
from contextualized import contextualized_tracebacks
from elasticsearch.exceptions import TransportError

from aggregator import shared_dcontext
from progressbar import ProgressBar, Percentage, Bar, Widget


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


def _add(index, submission_paths, only_these=None):
    from aggregator.record_aggregator import RecordAggregator
    record_aggregator = RecordAggregator(index)

    submission_label = Label(min_length=10)
    pbar = AlwaysUpdatingProgressBar(maxval=len(submission_paths),
                                     widgets=[
                                         Percentage(),
                                         submission_label,
                                         Bar(marker='#', left='[', right=']')
                                     ]).start()

    for i, submission_path in enumerate(submission_paths):
        shared_dcontext.dcontext.submission = os.path.basename(submission_path)
        submission_label.change_text(shared_dcontext.dcontext.submission)
        pbar.update(i)

        if only_these is not None:
            inspire_id = int(
                shared_dcontext.dcontext.submission.replace('ins', ''))
            if inspire_id not in only_these:
                continue

        try:
            record_aggregator.process_submission(submission_path)
        except TransportError as err:
            print(err)
            print(dir(err))
            raise err

    pbar.finish()
    print('Done', file=sys.stderr)
    record_aggregator.report_statistics()


def add(*submission_paths):
    _add('hepdata8', submission_paths)


def add_demo_subset(*submission_paths):
    # Add just a few publications, useful for testing the UI
    _add('hepdata-demo', submission_paths,
         only_these=[1198427, 1116150, 1296861, 1334140, 1345354, 1383884,
                     1386475, 1373912, 1343107])


def add_demo_mini():
    # Add a couple of fake publications, useful to test ElasticSearch queries
    from aggregator.record_aggregator import RecordAggregator
    record_aggregator = RecordAggregator('hepdata-mini-demo')
    record_aggregator.load_mini_demo()
    record_aggregator.report_statistics()


def main():
    with contextualized_tracebacks(
            ['submission', 'table', 'reading_file']) as dcontext:
        shared_dcontext.dcontext = dcontext
        argh.dispatch_commands([
            add,
            add_demo_subset,
            add_demo_mini,
        ])


if __name__ == "__main__":
    main()
