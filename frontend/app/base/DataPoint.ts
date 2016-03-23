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