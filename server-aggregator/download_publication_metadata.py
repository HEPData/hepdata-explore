import os
from concurrent.futures.thread import ThreadPoolExecutor

import re

import argh
import requests

re_record = re.compile(r'.*ins(\d+)$')


def download_publication(publication_path):
    publication_path = publication_path.rstrip('/')
    dest_file_path = os.path.join(publication_path, 'publication.json')
    if os.path.exists(dest_file_path):
        return

    inspire_record = re_record.match(publication_path).groups()[0]

    response = requests.get('https://hepdata.net/record/ins' + inspire_record +
                            '?format=json&light=true')
    assert response.json() is not None

    with open(dest_file_path, 'w') as f:
        f.write(response.text)


def download_publications(*directory_paths):
    with ThreadPoolExecutor(max_workers=64) as executor:
        futures = []
        for path in directory_paths:
            futures.append(executor.submit(download_publication, path))

        # Wait for all subprocesses to finish, in the same order they were
        # launched
        for future in futures:
            # Print a exception if any of them failed
            error = future.exception()
            if error:
                raise error


if __name__ == '__main__':
    argh.dispatch_command(download_publications)
