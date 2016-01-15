import contextlib

from aggregator.uninterruptible import uninterruptible_section

current_transaction = None


class Transaction(object):
    def __init__(self):
        self.committed = False
        self._data_to_be_written = {}  # type: dict[file, bytes]
        self._files_to_close = set() # type: set[file]

    def write(self, fp, data):
        if 'b' in fp.mode:
            # binary file
            empty_string = b''
            assert(isinstance(data, bytes))
        else:
            # text file
            empty_string = ''
            assert(isinstance(data, str))
        new_buf = self._data_to_be_written.get(fp, empty_string) + data
        self._data_to_be_written[fp] = new_buf

    def close(self, fp):
        self._files_to_close.add(fp)

    def commit(self):
        assert(not self.committed)
        with uninterruptible_section():
            self.committed = True
            for (fp, data) in self._data_to_be_written.items():
                fp.write(data)
            for fp in self._files_to_close:
                fp.close()


@contextlib.contextmanager
def in_transaction():
    global current_transaction
    current_transaction = Transaction()
    yield
    current_transaction.commit()
    current_transaction = None


def get_current_transaction():
    if current_transaction:
        return current_transaction
    else:
        raise RuntimeError("Not in transaction")