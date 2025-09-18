import { z } from 'zod';

// Base schema for common fields
const baseFields = {
  id: z.uuid(),
  createdOn: z.date().nullable(),
  createdBy: z.string().max(50).nullable(),
  updatedOn: z.date().nullable(),
  updatedBy: z.string().max(50).nullable(),
};

// GoogleRawBusiness schema
export const GoogleRawBusinessSchema = z.object({
  ...baseFields,
  name: z.string().max(75).nullable(),
  addressFull: z.json().nullable(),
  primaryPhone: z.string().max(30).nullable(),
  uri: z.string().max(150).nullable(),
  data: z.json().nullable(),
});

export const CreateGoogleRawBusinessSchema = GoogleRawBusinessSchema.omit({
  id: true,
  createdOn: true,
  updatedOn: true,
});

export const UpdateGoogleRawBusinessSchema = CreateGoogleRawBusinessSchema.partial();

// YelpRawBusiness schema
export const YelpRawBusinessSchema = z.object({
  ...baseFields,
  name: z.string().max(75).nullable(),
  addressFull: z.json().nullable(),
  primaryPhone: z.string().max(30).nullable(),
  uri: z.string().max(150).nullable(),
  data: z.json().nullable(),
});

export const CreateYelpRawBusinessSchema = YelpRawBusinessSchema.omit({
  id: true,
  createdOn: true,
  updatedOn: true,
});

export const UpdateYelpRawBusinessSchema = CreateYelpRawBusinessSchema.partial();

// User schema
export const UserSchema = z.object({
  ...baseFields,
  email: z.email().max(75).nullable(),
  role: z.string().max(50).nullable(),
});

export const CreateUserSchema = UserSchema.omit({
  id: true,
  createdOn: true,
  updatedOn: true,
});

export const UpdateUserSchema = CreateUserSchema.partial();

// BusinessAustin schema
export const BusinessAustinSchema = z.object({
  ...baseFields,
  googlePlaceId: z.uuid().nullable(),
  yelpId: z.uuid().nullable(),
  name: z.string().max(75).nullable(),
  addressFull: z.json().nullable(),
  primaryPhone: z.string().max(30).nullable(),
  uri: z.string().max(150).nullable(),
});

export const CreateBusinessAustinSchema = BusinessAustinSchema.omit({
  id: true,
  createdOn: true,
  updatedOn: true,
});

export const UpdateBusinessAustinSchema = CreateBusinessAustinSchema.partial();

// PendingDeal schema
export const PendingDealSchema = z.object({
  ...baseFields,
  googlePlaceId: z.uuid().nullable(),
  yelpId: z.uuid().nullable(),
  dealType: z.string().max(30).nullable(),
  name: z.string().max(75).nullable(),
  addressFull: z.json().nullable(),
  primaryPhone: z.string().max(30).nullable(),
  uri: z.string().max(150).nullable(),
});

export const CreatePendingDealSchema = PendingDealSchema.omit({
  id: true,
  createdOn: true,
  updatedOn: true,
});

export const UpdatePendingDealSchema = CreatePendingDealSchema.partial();

// Export types for TypeScript
export type GoogleRawBusiness = z.infer<typeof GoogleRawBusinessSchema>;
export type CreateGoogleRawBusiness = z.infer<typeof CreateGoogleRawBusinessSchema>;
export type UpdateGoogleRawBusiness = z.infer<typeof UpdateGoogleRawBusinessSchema>;

export type YelpRawBusiness = z.infer<typeof YelpRawBusinessSchema>;
export type CreateYelpRawBusiness = z.infer<typeof CreateYelpRawBusinessSchema>;
export type UpdateYelpRawBusiness = z.infer<typeof UpdateYelpRawBusinessSchema>;

export type User = z.infer<typeof UserSchema>;
export type CreateUser = z.infer<typeof CreateUserSchema>;
export type UpdateUser = z.infer<typeof UpdateUserSchema>;

export type BusinessAustin = z.infer<typeof BusinessAustinSchema>;
export type CreateBusinessAustin = z.infer<typeof CreateBusinessAustinSchema>;
export type UpdateBusinessAustin = z.infer<typeof UpdateBusinessAustinSchema>;

export type PendingDeal = z.infer<typeof PendingDealSchema>;
export type CreatePendingDeal = z.infer<typeof CreatePendingDealSchema>;
export type UpdatePendingDeal = z.infer<typeof UpdatePendingDealSchema>;
