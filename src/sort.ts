import { DEFAULT_CONFIGS, getConfig } from 'import-sort-config';
import { TextDocument, window } from 'vscode';
import { dirname, extname, relative } from 'path';
import { getConfiguration, getMaxRange } from './utils';
import importSort, { ISortResult } from 'import-sort';

import onSave from './on-save';

var MATCH_OPERATORS_RE = /[|\\{}()[\]^$+*?.]/g;

function escapeRegExp(str) {
    if (typeof str !== 'string') {
        throw new TypeError('Expected a string');
    }

    return str.replace(MATCH_OPERATORS_RE, '\\$&');
};


// const findImports = /^import [^\n]+\n+/gm;
const defaultLanguages = [
    'javascript',
    'typescript',
];

let cachedParser: string;
let cachedStyle: string;

function fixImports(directory: string, filename: string, currentCode: string) {
    function replacer(matches, m1) {

    }

    const currentPkgRes = /(.+\/packages\/)(\@[a-z\-]+\/[a-z\-]+|[a-z\-]+)(\/|$)/.exec(directory);
    if (currentPkgRes) {
        const path = currentPkgRes[1];
        const pkgName = currentPkgRes[2];
        const regEx = new RegExp(`from '(${escapeRegExp(pkgName)}.*)'\;`, 'g');
        let matches: RegExpExecArray;
        return currentCode.replace(regEx, (matches, m1) => {
            const dest = path + m1
            let newPath = relative(directory, dest);
            if (newPath[0] !== '.') {
                newPath = './' + newPath;
            }

            return `from '${newPath}';`;
        });
        // write from current pwd to destination. 
    }

    return currentCode;
}

export function sort(document: TextDocument): string {
    const languages = getConfiguration<string[]>('languages') || defaultLanguages;
    const isValidLanguage = languages.some(language => document.languageId.includes(language));

    if (!isValidLanguage) {
        return;
    }

    let currentText = document.getText();
    const fileName = document.fileName;
    const extension = extname(fileName);
    const directory = dirname(fileName);
    currentText = fixImports(directory, fileName, currentText);

    let result: ISortResult;
    const config = { ...DEFAULT_CONFIGS };
    const defaultSortStyle = getConfiguration<string>('default-sort-style');
    for (const languages in config) {
        if (config.hasOwnProperty(languages)) {
            config[languages].style = defaultSortStyle;
        }
    }

    const useCache = getConfiguration<boolean>('cache-package-json-config-checks');

    try {
        if (useCache && cachedParser === undefined) {
            const { parser, style } = getConfig(extension, directory, config);
            cachedParser = parser;
            cachedStyle = style;
            const result = importSort(currentText, parser, style, fileName);
            return result.code;
        } else {
            const result = importSort(currentText, cachedParser, cachedStyle, fileName);
            return result.code;
        }
    } catch (exception) {
        if (!getConfiguration<boolean>('suppress-warnings')) {
            window.showWarningMessage(`Error sorting imports: ${exception}`);
        }
        return null;
    }
}


export function sortCurrentDocument() {
    const {
        activeTextEditor: editor,
        activeTextEditor: { document }
    } = window;

    const sortedText = sort(document);
    if (!sortedText) {
        return;
    }

    return editor.edit(edit => edit.replace(getMaxRange(), sortedText));
}


export async function saveWithoutSorting() {
    const { document } = window.activeTextEditor;
    onSave.bypass(async () => await document.save());
}
