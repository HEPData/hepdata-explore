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
    value: number|null;

    // Raw error/range values
    errors?: DataPointError[];
    low?: number;
    high?: number;

    // Computed simple error (ranges are interpreted as errors too)
    // Both are guaranteed to be positive.
    error_up: number|null;
    error_down: number|null;
}



export interface DataPointErrorBase {
    type: "symerror" | "asymerror";
    label: string;
}

export interface AsymmetricDataPointError extends DataPointErrorBase {
    minus: number;
    plus: number;
}

export interface SymmetricDataPointError extends DataPointErrorBase {
    value: number;
}

// There are only two kinds of error (well, at least for those living in the
// `errors` property)
export type DataPointError = AsymmetricDataPointError | SymmetricDataPointError;

export function isSymmetricError(error: DataPointError): error is SymmetricDataPointError {
    return error.type == 'symerror';
}