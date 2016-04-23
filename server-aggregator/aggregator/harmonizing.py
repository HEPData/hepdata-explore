from math import isinf, isnan
import re


class NotNumeric(Exception):
    pass


class NotFound(Exception):
    pass


class TooManyResults(Exception):
    pass


def coerce_float_or_null(value):
    if value == '-':
        return None
    else:
        return coerce_float(value)


# All this to parse a floating point number :)
re_src_float = r'[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?'
re_number_exp_number = re.compile('(' + re_src_float + ') *exp *(' +
                                  re_src_float + ')')


def coerce_float(value):
    if type(value) == float:
        if isinf(value):
            # JSON does not accept Infinity :(
            if value > 0:
                return 1.7e308
            else:
                return -1.7e308
        elif isnan(value):
            raise NotNumeric(value)
        else:
            return value

    # Maybe it's a weird scientific notation format
    sn_match = re_number_exp_number.match(value)
    if sn_match:
        print(sn_match.groups())
        base, exp = sn_match.groups()
        return float(base + 'e' + exp)
    else:
        raise NotNumeric(value)

re_latex_plusminus_range = re.compile('(' + re_src_float + r') *\\\$pm\$ *(' +
                                      re_src_float + ')')


def value_is_actually_a_range(value):
    return isinstance(value, str) and re_latex_plusminus_range.match(value)


def parse_value_range(value):
    return tuple(
        coerce_float(float(x.strip()))
        for x in value.split(r'$\pm$')
    )


def find_keyword(table, keyword):
    matches = [
        k for k in table['keywords']
        if k['name'] == keyword
        ]
    if len(matches) == 1:
        return matches[0]['values']
    elif len(matches) == 0:
        #raise KeyError('No keyword ' + keyword)
        return []
    else:
        raise RuntimeError('Too many entries for keyword ' + keyword)


def one(iterable):
    count = 0
    for value in iterable:
        count += 1
        ret = value
    if count == 1:
        return ret
    elif count == 0:
        raise NotFound()
    else:
        raise TooManyResults()


def find_inspire_record(submission_header):
    return one(
            record['id']
            for record in submission_header['record_ids']
            if record['type'] == 'inspire'
    )


def find_qualifier(dep_var, name, allow_many=False):
    matches = [
        k for k in dep_var['qualifiers']
        if k['name'] == name
        ]
    if len(matches) == 0:
        raise KeyError('No qualifier ' + name)
    else:
        if allow_many:
            return [x['value'] for x in matches]
        elif len(matches) == 1:
            return matches[0]['value']
        else:
            raise RuntimeError('Too many entries for qualifier ' + name)


def ensure_list(thing):
    assert isinstance(thing, list), (type(thing))
    return thing
