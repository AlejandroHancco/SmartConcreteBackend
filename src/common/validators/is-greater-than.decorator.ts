import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'isGreaterThan' })
class IsGreaterThanConstraint implements ValidatorConstraintInterface {
  validate(value: number, args: ValidationArguments) {
    const [relatedProperty] = args.constraints;
    const relatedValue = (args.object as any)[relatedProperty];
    return typeof value === 'number' && typeof relatedValue === 'number' && value > relatedValue;
  }

  defaultMessage(args: ValidationArguments) {
    const [relatedProperty] = args.constraints;
    return `${args.property} debe ser mayor que ${relatedProperty}`;
  }
}

/** Valida que este campo sea numéricamente mayor que otro campo del mismo objeto (ej. stopFreq > startFreq). */
export function IsGreaterThan(relatedProperty: string, options?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      constraints: [relatedProperty],
      validator: IsGreaterThanConstraint,
    });
  };
}
