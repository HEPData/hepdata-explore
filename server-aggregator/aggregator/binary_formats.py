import struct

import sys
from unittest import TestCase

if sys.version_info < (3,):
    byte = chr
else:
    def byte(value):
        return bytes((value,))


def uint32_format(number):
    return struct.pack('<L', number)


def varint_format(number):
    assert (number >= 0)
    if number <= 0x7f:
        return byte(number)
    else:
        current_part = 0x80 | (number & 0x7f)
        next_part = number >> 7
        return byte(current_part) + varint_format(next_part)


def size_format(number):
    return varint_format(number)


def string_format(a_string):
    data = a_string.encode('UTF-8')
    return varint_format(len(data)) + data


class TestVarint(TestCase):
    def test_varint(self):
        self.assertEqual(varint_format(600), b'\xD8\x04')
        self.assertEqual(varint_format(123456), b'\xC0\xC4\x07')
