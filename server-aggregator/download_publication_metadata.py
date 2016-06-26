import os
from concurrent.futures.thread import ThreadPoolExecutor

import re

import argh
import requests
from contextualized import contextualized_tracebacks

re_record = re.compile(r'.*ins(\d+)$')


def download_publication(publication_path):
    publication_path = publication_path.rstrip('/')
    dest_file_path = os.path.join(publication_path, 'publication.json')
    if os.path.exists(dest_file_path):
        return

    match = re_record.match(publication_path)
    if match:
        inspire_record = match.groups()[0]
    else:
        print('Ignoring directory with invalid format: %s' % publication_path)
        return

    response = requests.get('https://hepdata.net/record/ins' + inspire_record +
                            '?format=json&light=true')

    # Not Found errors don't use real 404 codes
    if "we weren't able to find what you were looking for" in response.text:
        print('Warning: Not Found error on %s' % inspire_record)
        return

    assert response.json() is not None

    with open(dest_file_path, 'w') as f:
        f.write(response.text)


def download_publications(*directory_paths):
    with ThreadPoolExecutor(max_workers=64) as executor:
        tasks = []
        for path in directory_paths:
            future = executor.submit(download_publication, path)
            tasks.append((future, path))

        # Wait for all subprocesses to finish, in the same order they were
        # launched
        for future, path in tasks:
            # Print a exception if any of them failed
            error = future.exception()
            if error:
                print('Error caught in submission directory "%s"' % path)
                raise error


if __name__ == '__main__':
    argh.dispatch_command(download_publications)
