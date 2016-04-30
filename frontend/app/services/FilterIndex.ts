import Filter = require("../filters/Filter");
import KeywordFilter = require("../filters/KeywordFilter");
import AllFilter = require("../filters/AllFilter");
import {IndepVarFilter, DepVarFilter} from "../filters/filter-factories";
import SomeFilter = require("../filters/SomeFilter");


interface FilterIndexRecordDefinition {
    filterClass: typeof Filter
    description: string
    tags: string[]
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
    private indexText: lunr.Index;
    private indexTags: lunr.Index;
    private database: FilterIndexRecord[] = [];

    constructor() {
        // Searches for text, ignoring a defined set of stopwords
        this.indexText = lunr(function() {
            this.field('name', {boost: 10});
            this.field('description');
            this.ref('id');
        });

        // Index by manually chosen tags which are thought to be usual when
        // searching for filters but could be in the stopwords set.
        this.indexTags = lunr(function() {
            this.field('tags');
            this.ref('id');
        });
        this.indexTags.pipeline.remove(lunr.stopWordFilter);
    }

    public populate(records: FilterIndexRecordDefinition[]) {
        for (let recordDef of records) {
            // Cast and add missing properties
            const record = <FilterIndexRecord>recordDef;
            record.id = this.database.length;
            record.name = record.filterClass.getLongName();

            this.database.push(record);
            this.indexText.add(_.defaults({
                // Strip HTML tags in the index
                description: FilterIndex.stripHtmlTags(record.description),
            }, record));
            this.indexTags.add({
                id: record.id,
                tags: record.tags,
            });
        }
    }

    public search(query: string): FilterIndexSearchResult[] {
        const resultsTags = this.indexTags.search(query);
        const resultsText = this.indexText.search(query);

        // Merge the results. Tags matches take priority.
        const resultsMerged = _.uniqBy(resultsTags.concat(resultsText),
            'ref');
        return resultsMerged.map((result) => {
            return {
                match: this.database[result.ref],
                score: result.score,
            };
        })
    }

    public returnAll(): FilterIndexSearchResult[] {
        return this.database.map(record => ({
            match: record,
            score: null,
        }));
    }

    private static stripHtmlTags(html) {
        const el = document.createElement('div');
        el.innerHTML = html;
        return el.textContent;
    }
}
export const filterIndex = new FilterIndex();

filterIndex.populate([
    // {
    //     filterClass: KeywordFilter,
    //     description: `Each HEPData table has a series of keywords. This filter allows you to filter by one of these.`,
    //     tags: ['keyword'],
    // },
    {
        filterClass: AllFilter,
        description: `Performs a logical <code>AND</code>. This compound filter matches a data point if it matches <b>all</b> the filters inside it.`,
        tags: ['all', 'and', 'compound'],
    },
    {
        filterClass: SomeFilter,
        description: `Performs a logical <code>OR</code>. This compound filter matches a data point if it matches <b>at least one</b> the filters inside it.`,
        tags: ['all', 'and', 'compound'],
    },
    {
        filterClass: IndepVarFilter,
        description: `Returns data points with for a certain independent variable.`,
        tags: ['x', 'indep', 'independent', 'variable'],
    },
    {
        filterClass: DepVarFilter,
        description: `Returns data points with for a certain dependent variable.`,
        tags: ['y', 'dep', 'dependent', 'variable'],
    },
]);
