import fs from 'fs';
import path from 'path';

const sampleInputPath = path.resolve('sample_input.json');
const inputSchemaPath = path.resolve('.actor/input_schema.json');

function getFutureDate(daysAhead) {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    return d.toISOString().split('T')[0];
}

const newDepartureDate = getFutureDate(30);
const newReturnDate = getFutureDate(37);

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