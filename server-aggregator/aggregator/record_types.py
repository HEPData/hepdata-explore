from collections import namedtuple

TableGroupMetadata = namedtuple('TableGroup',
                                ['inspire_record', 'table_num', 'cmenergies', 'reaction',
                                 'observables', 'var_x', 'var_y'])
Record = namedtuple('Record', ['x_low', 'x_high', 'y', 'errors'])