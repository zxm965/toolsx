const isNumber = (value: any): value is number => typeof value === 'number';
const isString = (value: any): value is string => typeof value === 'string';

export { isNumber, isString };
