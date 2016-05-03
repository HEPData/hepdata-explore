import hashlib
import struct

url_chars = '123456789abcdefghkmnpqrstuvwxyzABCDEFGHKMNPQRSTUVWXYZ'
len_url_string = 5
url_number_modulo = len(url_chars) ** len_url_string


def number_to_url_string(number):
    assert(number < url_number_modulo)
    output = ''
    for i in range(len_url_string):
        output = url_chars[number % len(url_chars)] + output
        number = number // len(url_chars)
    return output


def url_string_to_number(url_string):
    if len(url_string) != len_url_string:
        raise ValueError('Invalid URL string')

    number = 0
    for i, char in enumerate(reversed(url_string)):
        # .index() will also throw a ValueError if invalid characters are used
        number += url_chars.index(char) * len(url_chars) ** i
    return number


def hash_to_url_number(string):
    assert(len(string) >= 4)
    suffix = string[-4:]  # last four bytes
    return struct.unpack('>L', suffix)[0] % url_number_modulo


def hash_string(a_string):
    m = hashlib.sha224()
    m.update(a_string.encode('UTF-8'))
    return m.digest()


def custom_url_hash(value):
    return number_to_url_string(hash_to_url_number(hash_string(value)))
