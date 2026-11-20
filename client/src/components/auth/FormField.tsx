import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type ComponentProps, useId } from 'react';

/**
 * Labelled input for the auth forms.
 *
 * @param {object} props  `label` plus any `<input>` props.
 */
export function FormField({
  label,
  ...inputProps
}: { label: string } & ComponentProps<'input'>) {
  const id = useId();
  return (
    <div className='grid gap-2'>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} className='h-10 bg-background' {...inputProps} />
    </div>
  );
}
