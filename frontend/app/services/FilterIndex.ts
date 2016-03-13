import Filter = require("../filters/Filter");
import KeywordFilter = require("../filters/KeywordFilter");
import AllFilter = require("../filters/AllFilter");

interface FilterIndexRecordDefinition {
    filterClass: typeof Filter
    description: string
}

export interface FilterIndexRecord extends FilterIndexRecordDefinition{
    id: number // automatically assigned
    name: string // extracted from getLongName()
}

export interface FilterIndexSearchResult {
    match: FilterIndexRecord
    score: number
}

class FilterIndex {
    private index: lunr.Index;
    private database: FilterIndexRecord[] = [];

    constructor() {
        this.index = lunr(function() {
            this.field('name', {boost: 10});
            this.field('description');
            this.ref('id');
        });
    }

    public populate(records: FilterIndexRecordDefinition[]) {
        for (const recordDef of records) {
            // Cast and add missing properties
            const record = <FilterIndexRecord>recordDef;
            record.id = this.database.length;
            record.name = record.filterClass.getLongName();

            this.database.push(record);
            this.index.add(_.defaults({
                // Strip HTML tags in the index
                description: FilterIndex.stripHtmlTags(record.description),
            }, record));
        }
    }

    public search(query: string): FilterIndexSearchResult[] {
        const results = this.index.search(query);
        return results.map((result) => {
            return {
                match: this.database[result.ref],
                score: result.score,
            };
        })
    }

    private static stripHtmlTags(html) {
        const el = document.createElement('div');
        el.innerHTML = html;
        return el.textContent;
    }
}
export const filterIndex = new FilterIndex();

filterIndex.populate([
    {
        filterClass: KeywordFilter,
        description: `Each HEPData table has a series of keywords. This filter allows you to filter by one of these.`
    },
    {
        filterClass: AllFilter,
        description: `Performs a logical <code>AND</code>. This compound filter matches a result if it matches <b>all</b> the filters inside it.`
    },
]);