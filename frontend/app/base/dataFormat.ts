export interface Publication {
    comment: string;
    inspire_record: number;
    tables: PublicationTable[];
}

export interface VariableQualifier {
    name: string;
    value: string;
}

export interface Reaction {
    string_full: string;
    string_in: string;
    string_out: string;
    particles_in: string[];
    particles_out: string[];
}

export interface PublicationTable {
    // Parent node
    publication: Publication;

    table_num: number;
    description: string;

    cmenergies_min: number;
    cmenergies_max: number;
    reactions: Reaction[];
    observables: string[];
    phrases: string[];

    indep_vars: {
        name: string;
    }[];
    dep_vars: {
        name: string;
        qualifiers: VariableQualifier[];
    }[];

    data_points: DataPoint[];
}

export type DataPoint = DataPointColumn[];

export interface DataPointColumn {
    value: number;
    low: number;
    high: number;
    errors: DataPointError[];
}

export interface DataPointError {
    label: string;
    minus: number;
    plus: number;
}