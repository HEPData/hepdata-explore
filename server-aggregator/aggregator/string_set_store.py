from aggregator.shared_dcontext import dcontext
from aggregator.transactions import get_current_transaction


class StringSetStore(object):
    """
    Maintains a file with a list of strings, unsorted.
    Loads the list in memory as a set and allows to query if strings exists and add new strings as needed.

    The file contains one string per line.
    Newlines '\n' and empty strings are not allowed.
    """

    def __init__(self, path):
        self.path = path
        self.fp = open(path, 'a+')
        self.fp.seek(0)

        dcontext.reading_file = self.path
        # load non empty lines
        self.strings = set(s for s in self.fp.read().split('\n')
                           if s.strip() != '')
        dcontext.reading_file = None

    def close(self):
        t = get_current_transaction()
        t.close(self.fp)

    def add_string(self, string):
        assert '\n' not in string
        assert string.strip() != ''
        t = get_current_transaction()
        
        if string not in self.strings:
            self.strings.add(string)

            if self.fp.tell() != 0:
                t.write(self.fp, '\n')
            t.write(self.fp, string)
            
    def __contains__(self, item):
        return item in self.strings
