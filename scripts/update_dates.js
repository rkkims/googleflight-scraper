import fs from 'fs';
import path from 'path';

const sampleInputPath = path.resolve('sample_input.json');
const inputSchemaPath = path.resolve('.actor/input_schema.json');
const readmePath = path.resolve('README.md');

function getFutureDate(daysAhead) {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    return d.toISOString().split('T')[0];
}

const newDepartureDate = getFutureDate(30);
const newReturnDate = getFutureDate(37);
const nextDayDate = getFutureDate(31);

// Update sample_input.json
if (fs.existsSync(sampleInputPath)) {
    const sampleInput = JSON.parse(fs.readFileSync(sampleInputPath, 'utf8'));
    sampleInput.departure_date = newDepartureDate;
    sampleInput.return_date = newReturnDate;
    fs.writeFileSync(sampleInputPath, JSON.stringify(sampleInput, null, 2) + '\n');
    console.log(`Updated sample_input.json with dates: ${newDepartureDate}, ${newReturnDate}`);
}

// Update .actor/input_schema.json
if (fs.existsSync(inputSchemaPath)) {
    const inputSchema = JSON.parse(fs.readFileSync(inputSchemaPath, 'utf8'));
    if (inputSchema.properties.departure_date) {
        inputSchema.properties.departure_date.prefill = newDepartureDate;
    }
    if (inputSchema.properties.return_date) {
        inputSchema.properties.return_date.prefill = newReturnDate;
    }
    fs.writeFileSync(inputSchemaPath, JSON.stringify(inputSchema, null, 2) + '\n');
    console.log(`Updated .actor/input_schema.json with dates: ${newDepartureDate}, ${newReturnDate}`);
}

// Update README.md
if (fs.existsSync(readmePath)) {
    let readme = fs.readFileSync(readmePath, 'utf8');
    
    // Replace standard YYYY-MM-DD dates
    readme = readme.replace(/("departure_date":\s*")\d{4}-\d{2}-\d{2}(")/g, `$1${newDepartureDate}$2`);
    readme = readme.replace(/("date":\s*")\d{4}-\d{2}-\d{2}(")/g, (match, p1, p2, offset, string) => {
        const prevText = string.substring(offset - 100, offset);
        if (prevText.includes('"flight_number": "604"')) {
             return `${p1}${nextDayDate}${p2}`;
        }
        return `${p1}${newDepartureDate}${p2}`;
    });
    
    readme = readme.replace(/("return_date":\s*")\d{4}-\d{2}-\d{2}(")/g, `$1${newReturnDate}$2`);
    readme = readme.replace(/(e\.g\.,\s*")\d{4}-\d{2}-\d{2}(")/g, `$1${newDepartureDate}$2`);
    
    const newDepSlash = newDepartureDate.replace(/-/g, '/');
    readme = readme.replace(/(e\.g\.,\s*")\d{4}\/\d{2}\/\d{2}(")/g, `$1${newDepSlash}$2`);
    
    const [y, m, d] = newDepartureDate.split('-');
    const newDepUS = `${m}/${d}/${y}`;
    readme = readme.replace(/(e\.g\.,\s*")\d{2}\/\d{2}\/\d{4}(")/g, `$1${newDepUS}$2`);

    fs.writeFileSync(readmePath, readme);
    console.log(`Updated README.md with new example dates.`);
}
