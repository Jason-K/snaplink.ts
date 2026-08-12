import fs from 'fs';
import path from 'path';

function replaceInFile(filePath, replacements) {
    const fullPath = path.resolve(__dirname, filePath);
    let content = fs.readFileSync(fullPath, 'utf8');
    for (const [search, replace] of replacements) {
        content = content.replace(search, replace);
    }
    fs.writeFileSync(fullPath, content);
}

replaceInFile('src/tests/binding.test.ts', [
    ['test("resolveCondition var if/unless -> expression_if/unless"', 'test("resolveCondition var if/unless -> variable_if/unless"'],
    ['{ type: "expression_if", expression: "x == 1" }', '{ type: "variable_if", name: "x", value: 1 }'],
    ['{ type: "expression_unless", expression: "y == 0" }', '{ type: "variable_unless", name: "y", value: 0 }'],
]);

replaceInFile('src/tests/caps-layer.test.ts', [
    ['{ type: "expression_if", expression: `${USED.name} == 0` }', '{ type: "variable_if", name: USED.name, value: 0 }'],
    ['{ type: "expression_if", expression: `${PRESSED.name} == 1` }', '{ type: "variable_if", name: PRESSED.name, value: 1 }'],
    ['c.type === "expression_if" && !(c as { expression: string }).expression.startsWith(PRESSED.name)', 'c.type === "variable_if" && (c as any).name !== PRESSED.name'],
]);

replaceInFile('src/tests/condition-handlers.test.ts', [
    ['test("var condition compiles to expression_if / expression_unless"', 'test("var condition compiles to variable_if / variable_unless"'],
    ['{ type: "expression_if", expression: "flag == 1" }', '{ type: "variable_if", name: "flag", value: 1 }'],
    ['{ type: "expression_unless", expression: "flag == 1" }', '{ type: "variable_unless", name: "flag", value: 1 }'],
]);

replaceInFile('src/tests/rule-emission.test.ts', [
    ['c.type === "expression_if" && (c as any).expression.startsWith("caps_lock_pressed")', 'c.type === "variable_if" && (c as any).name === "caps_lock_pressed"'],
]);

replaceInFile('src/tests/output-invariants.test.ts', [
    ['if (condition.type === "expression_if" || condition.type === "expression_unless") {', 'if (condition.type === "variable_if" || condition.type === "variable_unless") {\n        const name = (condition as any).name;\n        vars.add(name);\n      }\n      if (condition.type === "expression_if" || condition.type === "expression_unless") {'],
]);
