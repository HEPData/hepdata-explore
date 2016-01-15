import hashlib
import json
import os

import binascii

from aggregator.uninterruptible import uninterruptible_section


def short_hash(a_string):
    m = hashlib.sha1()
    m.update(a_string.encode('UTF-8'))
    return binascii.hexlify(m.digest())[-6:].decode()


class VariableIndex(object):
    def __init__(self, root_dir, path_inside):
        self.root_dir = root_dir
        self.path = os.path.join(root_dir, path_inside)
        try:
            with open(self.path, 'r') as f:
                self.index = json.load(f)
        except FileNotFoundError:
            # Start with empty index
            self.index = {}  # dict<var_name, dict>

    def update_index(self):
        with uninterruptible_section():
            with open(self.path, 'w') as f:
                f.write(json.dumps(self.index))

    def _dir_full_path(self, directory_name):
        return os.path.join(self.root_dir, directory_name)

    def get_var_directory(self, var):
        """Returns the path for a variable directory data storage.
        :param var: The variable name.
        """

        # If a directory has been already set for that variable in the index, use it.
        if var in self.index:
            return self._dir_full_path(self.index[var]['dirName'])
        else:
            # Assign a new directory for this variable...

            # Calculate a short hash
            hash = short_hash(var)

            # Sanitize the variable name
            dir_name = self.safe_filename(var, hash)

            # Hashify the directory so there are not directories with thousands of entries, which would render
            # filesystems slow and unresponsive
            dir_name = self.hashify(dir_name, hash)

            self.index[var] = {
                "dirName": dir_name,
                "recordCount": 0,
            }
            self.update_index()

            full_path = self._dir_full_path(dir_name)
            os.makedirs(full_path)
            return full_path

    def update_record_count(self, var, num_new_records):
        self.index[var]['recordCount'] += num_new_records
        self.update_index()

    @staticmethod
    def safe_filename(dependent_variable, hash):
        """Return a directory name without too many strange characters,
        suitable to use for a dependent variable."""
        keep_characters = (' ', '.', '_')
        safe_var_name = ''.join(c for c in dependent_variable
                                if c.isalnum() or c in keep_characters)

        # Add a hash, just in case some variables have very similar names
        return safe_var_name + ' - ' + hash

    @staticmethod
    def hashify(dir_name, hash):
        return os.path.join(hash[-2:], dir_name)
