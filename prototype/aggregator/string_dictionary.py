from aggregator.shared_dcontext import dcontext
from aggregator.transactions import get_current_transaction


class StringDictionary(object):
    """
    Maintains a file with mappings string-integer.
    This allows to use small integers instead of relatively long, common strings.

    The file contains one string per line. The line number (starting at 1) is used
    as the string id. The string with index 0 is empty string.

    Newlines '\n' are not allowed in strings.
    """

    def __init__(self, path):
        self.path = path
        self.fp = open(path, 'a+')
        self.fp.seek(0)

        self.dict_str_to_id = {'': 0}
        self.dict_id_to_str = {0: ''}
        self.counter = 1
        self.load_existing_strings()

    def close(self):
        t = get_current_transaction()
        t.close(self.fp)

    def load_existing_strings(self):
        dcontext.reading_file = self.path
        for string in self.fp.read().split('\n'):
            if string != "":
                self.counter += 1
                str_id = self.counter
                self.dict_id_to_str[str_id] = string
                self.dict_str_to_id[string] = str_id

        dcontext.reading_file = None

    def add_string(self, string):
        assert '\n' not in string
        str_id = self.counter

        self.dict_id_to_str[str_id] = string
        self.dict_str_to_id[string] = str_id
        self.counter += 1
        t = get_current_transaction()
        t.write(self.fp, string + '\n')

        return str_id

    def str_from_id(self, str_id):
        return self.dict_id_to_str[str_id]

    def id_for_str(self, string):
        try:
            return self.dict_str_to_id[string]
        except KeyError:
            return self.add_string(string)
