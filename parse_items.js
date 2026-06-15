const fs = require('fs');

const rawDataFile = './items.json';
const outputFile = './web/src/app/parsed_items.json';

try {
  const rawData = JSON.parse(fs.readFileSync(rawDataFile, 'utf8'));
  const parsedData = { cars: [], items: [], clothing: [] };

  // Parse CARS
  if (rawData.CARS) {
    rawData.CARS.forEach((colArray, index) => {
      if (index === 0) return; // skip header
      for (let i = 0; i < colArray.length; i += 2) {
        const carName = colArray[i];
        if (carName && carName !== "----" && typeof carName === 'string') {
          parsedData.cars.push(carName);
        }
      }
    });
  }

  // Parse CLOTHING if it exists
  if (rawData.CLOTHING) {
     rawData.CLOTHING.forEach((colArray, index) => {
      if (index === 0) return;
      for (let i = 0; i < colArray.length; i += 2) {
        const item = colArray[i];
        if (item && item !== "----" && typeof item === 'string') {
          parsedData.clothing.push(item);
        }
      }
    });
  }

  // Parse ITEMS if it exists
  if (rawData.ITEMS) {
     rawData.ITEMS.forEach((colArray, index) => {
      if (index === 0) return;
      for (let i = 0; i < colArray.length; i += 2) {
        const item = colArray[i];
        if (item && item !== "----" && typeof item === 'string') {
          parsedData.items.push(item);
        }
      }
    });
  }

  // De-duplicate and sort
  parsedData.cars = [...new Set(parsedData.cars)].sort();
  parsedData.clothing = [...new Set(parsedData.clothing)].sort();
  parsedData.items = [...new Set(parsedData.items)].sort();

  fs.writeFileSync(outputFile, JSON.stringify(parsedData), 'utf8');
  console.log(`Successfully parsed items into ${outputFile}`);
  console.log(`Cars: ${parsedData.cars.length}`);
  console.log(`Clothing: ${parsedData.clothing.length}`);
  console.log(`Items: ${parsedData.items.length}`);

} catch (e) {
  console.error(e);
}
