import { ValidationOptions, registerDecorator, ValidationArguments } from 'class-validator';
import { isValidEgyptianMobile } from '../utils/phone.util';

/**
 * Accepts an Egyptian mobile number in any of the forms staff actually type
 * (`01001234567`, `+201001234567`, `0020 100 123 4567`).
 */
export function IsEgyptianMobile(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'isEgyptianMobile',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return typeof value === 'string' && isValidEgyptianMobile(value);
        },
        defaultMessage(args: ValidationArguments): string {
          return `${args.property} must be a valid Egyptian mobile number (e.g. 01001234567)`;
        },
      },
    });
  };
}
