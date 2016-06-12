import {StateDump} from "../base/StateDump";
import {
    YVarConfig,
    addYVariable
} from "../visualization/Plot";
import {assert} from "../utils/assert";

interface IVersion {
    version: number
}

export function updateV1toV2(dump: any): any {
    dump.plots = dump.plots.map((plot: any) => {
        const newYVars: YVarConfig[] = [];
        plot.yVars.forEach((yVarName: string) => {
            addYVariable(newYVars, yVarName);
        });
        plot.yVars = newYVars;
        return plot;
    });

    dump.version = 2;
    return dump;
}

export function migrateStateDump(dump: IVersion): StateDump {
    let migrated = false;
    if (dump.version == 1) {
        console.log('Migrating state from version 1... Before:');
        console.log(JSON.stringify(dump, null!, 2));
        dump = updateV1toV2(dump);
        migrated = true;
    }

    if (migrated) {
        console.log('Final state after all migrations:');
        console.log(JSON.stringify(dump, null!, 2));
    }

    assert(dump.version == 2, 'Unsupported state dump version');
    console.log(dump);
    return <StateDump>dump;
}