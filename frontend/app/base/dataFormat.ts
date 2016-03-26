export interface DataPoint {
    inspire_record: number;
    table_num: number;
    cmenergies1: number;
    cmenergies2: number;
    reaction: string;
    observables: string[];
    var_y: number;
    var_x: number;
    x_low: number;
    x_high: number;
    x_center: number;
    y: number;
    errors: any[];
}

export interface Publication {
    comment: string;
    inspire_record: number;
    tables: PublicationTable[];
}

export interface PublicationTable {
    table_num: number;
    description: string;
    observables: string[];
    groups: PublicationTableGroup[];
}

export interface PublicationTableGroup {
    cmenergies: number[];
    reaction: string;
    var_x: string;
    var_y: string;
    data_points: GroupDataPoint[];
}

export interface GroupDataPoint {
    x_high: number;
    x_low: number;
    y: number;
    errors: DataPointError[];
}

export interface DataPointError {
    label: string;
    minus: number;
    plus: number;
}