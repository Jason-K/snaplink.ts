import fs from 'fs';
import path from 'path';

function replaceInFile(filePath, replacements) {
    const fullPath = path.resolve(process.cwd(), filePath);
    let content = fs.readFileSync(fullPath, 'utf8');
    for (const [search, replace] of replacements) {
        content = content.replace(search, replace);
    }
    fs.writeFileSync(fullPath, content);
}

replaceInFile('src/tests/shift.test.ts', [
    ['c.type === "expression_if" && c.expression.endsWith("== 1")', 'c.type === "variable_if" && c.value === 1'],
    ['!m.conditions?.some((c: any) => c.type === "expression_if")', '!m.conditions?.some((c: any) => c.type === "variable_if" && c.value === 1)'],
    ['(c: any) => c.type === "expression_if"', '(c: any) => c.type === "variable_if"'],
]);

replaceInFile('src/tests/simultaneous.test.ts', [
    ['c.type === "expression_if" && c.expression.startsWith("sim_tap_jk")', 'c.type === "variable_if" && c.name.startsWith("sim_tap_jk")'],
]);

replaceInFile('src/tests/double-tap-guard.test.ts', [
    ['const cond = (secondPress.conditions?.[0] as any)?.expression;', 'const cond = (secondPress.conditions?.[0] as any);'],
    ['assert.strictEqual(cond, "guard_cmd_q == 1");', 'assert.deepEqual(cond, { type: "variable_if", name: "guard_cmd_q", value: 1 });'],
]);
