import {Filter} from "../filters/Filter";
import {
    IndepVarFilter,
    DepVarFilter,
    ReactionFilter,
    ObservableFilter,
    PhraseFilter, CollaborationFilter
} from "../filters/concrete-filters";
import {TableDescriptionFilter} from "../filters/TableDescriptionFilter";
import AllFilter = require("../filters/AllFilter");
import SomeFilter = require("../filters/SomeFilter");
import CMEnergiesFilter = require("../filters/CMEnergiesFilter");


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

export class FilterIndex {
    private textIndex: lunr.Index;
    private tagsIndex: lunr.Index;
    private database: FilterIndexRecord[] = [];

    constructor() {
        // Searches for text, ignoring a defined set of stopwords
        this.textIndex = lunr(function() {
            this.field('name', {boost: 10});
            this.field('description');
            this.ref('id');
        });

        // Index by manually chosen tags which are thought to be usual when
        // searching for filters but could be in the stopwords set.
        this.tagsIndex = lunr(function() {
            this.field('tags');
            this.ref('id');
        });
        this.tagsIndex.pipeline.remove(lunr.stopWordFilter);
    }

    public populate(records: FilterIndexRecordDefinition[]) {
        for (let recordDef of records) {
            // Cast and add missing properties
            const record = <FilterIndexRecord>recordDef;
            record.id = this.database.length;
            record.name = record.filterClass.getLongName();

            this.database.push(record);
            this.textIndex.add(_.defaults({
                // Strip HTML tags in the index
                description: FilterIndex.stripHtmlTags(record.description),
            }, record));
            this.tagsIndex.add({
                id: record.id,
                tags: record.tags,
            });
        }
    }

    public search(query: string): FilterIndexSearchResult[] {
        const resultsTags = this.tagsIndex.search(query);
        const resultsText = this.textIndex.search(query);

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
            score: 0,
        }));
    }

    private static stripHtmlTags(html: string) {
        const el = document.createElement('div');
        el.innerHTML = html;
        return el.textContent;
    }
}
export const filterIndex = new FilterIndex();

filterIndex.populate([
    {
        filterClass: AllFilter,
        description: `Performs a logical <code>AND</code>. This compound filter matches a table if it matches <b>all</b> the filters inside it.`,
        tags: ['all', 'and', 'compound'],
    },
    {
        filterClass: SomeFilter,
        description: `Performs a logical <code>OR</code>. This compound filter matches a table if it matches <b>at least one</b> the filters inside it.`,
        tags: ['some', 'or', 'any', 'compound'],
    },
    {
        filterClass: IndepVarFilter,
        description: `Returns tables with a certain independent variable.`,
        tags: ['x', 'indep', 'independent', 'variable'],
    },
    {
        filterClass: DepVarFilter,
        description: `Returns tables with a certain dependent variable.`,
        tags: ['y', 'dep', 'dependent', 'variable'],
    },
    {
        filterClass: CollaborationFilter,
        description: `Returns tables that are part of publications by a certain collaboration.`,
        tags: ['collaboration', 'research', 'group', 'experiment'],
    },
    {
        filterClass: ReactionFilter,
        description: `Returns tables referring a certain reaction.`,
        tags: ['reaction'],
    },
    {
        filterClass: ObservableFilter,
        description: `Returns tables matching a certain observable.`,
        tags: ['observable'],
    },
    {
        filterClass: PhraseFilter,
        description: `Returns tables matching a certain phrase (curated keywords).`,
        tags: ['phrase', 'keyword'],
    },
    {
        filterClass: CMEnergiesFilter,
        description: `Returns tables having a <code>cmenergies</code> overlapping the specified range.`,
        tags: ['sqrt', 'sqrts', 'cmenergies'],
    },
    {
        filterClass: TableDescriptionFilter,
        description: `Returns tables containing some text in their description.`,
        tags: ['table', 'name', 'description', 'content', 'regex', 'regexp'],
    },
]);

(<any>window).filterIndex = filterIndex;