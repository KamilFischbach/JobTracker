import { z } from 'zod';

const fields = {
  companyName: z.string().trim().min(1),
  jobTitle: z.string().trim().min(1),
  jobUrl: z.url().nullable().optional(),
  status: z
    .enum(['SAVED', 'APPLIED', 'INTERVIEW_SCHEDULED', 'OFFER', 'REJECTED'])
    .optional(),
  salaryMin: z.number().positive().nullable().optional(),
  salaryMax: z.number().positive().nullable().optional(),
  currency: z.string().trim().length(3).optional(),
  appliedDate: z.iso
    .date()
    .transform((date) => new Date(`${date}T00:00:00.000Z`))
    .nullable()
    .optional(),
  notes: z.string().nullable().optional(),
};

export const hasValidSalaryRange = (data: {
  salaryMin?: number | null | undefined;
  salaryMax?: number | null | undefined;
}) =>
  data.salaryMin == null ||
  data.salaryMax == null ||
  data.salaryMin <= data.salaryMax;

export const createApplicationSchema = z
  .object(fields)
  .refine(hasValidSalaryRange, {
    path: ['salaryMax'],
    message: 'Maximum salary must be at least the minimum salary.',
  });

export const updateApplicationSchema = z
  .object(fields)
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update',
  })
  .refine(hasValidSalaryRange, {
    path: ['salaryMax'],
    message: 'Maximum salary must be at least the minimum salary',
  });

export const deleteApplicationsSchema = z.object({
  ids: z
    .array(z.string().trim().min(1))
    .min(1)
    .max(100)
    .refine((ids) => new Set(ids).size === ids.length, {
      message: 'Application IDs must be unique.',
    }),
});
