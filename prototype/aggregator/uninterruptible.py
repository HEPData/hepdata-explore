import contextlib
import signal
import os

if os.name == 'posix':
    import pysigset

    @contextlib.contextmanager
    def uninterruptible_section():
        with pysigset.suspended_signals(signal.SIGINT):
            yield
else:
    @contextlib.contextmanager
    def uninterruptible_section():
        # Not supported on Windows OS
        yield