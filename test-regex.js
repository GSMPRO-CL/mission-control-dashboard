const prefix = 'gian';
console.log('Using \\b:', new RegExp('\\b' + prefix).test('gianlugi'));
console.log('Using \\\\b:', new RegExp('\\\\b' + prefix).test('gianlugi'));
