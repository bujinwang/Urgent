import { z } from 'zod'

// ---- User ----
export const UserTier = z.enum(['bronze', 'silver', 'gold', 'diamond'])
export type UserTier = z.infer<typeof UserTier>

export const UserProfile = z.object({
  id: z.string(),
  name: z.string(),
  avatar: z.string(),
  tier: UserTier,
  points: z.number(),
  city: z.string(),
  volunteerId: z.string(),
  certifications: z.array(z.string()),
  rescueCount: z.number(),
})
export type UserProfile = z.infer<typeof UserProfile>

export const Stats = z.object({
  certifiedRescuers: z.number(),
  networkedAeds: z.number(),
  monthlyRescues: z.number(),
  onlineVolunteers: z.number(),
  aedsWithin1km: z.number(),
})
export type Stats = z.infer<typeof Stats>

// ---- Task ----
export const TaskType = z.enum(['cpr', 'aed', 'assist'])
export type TaskType = z.infer<typeof TaskType>

export const RescueTask = z.object({
  id: z.string(),
  type: TaskType,
  address: z.string(),
  distance: z.number(),
  lat: z.number(),
  lng: z.number(),
  volunteersNeeded: z.number(),
  volunteersResponded: z.number(),
  status: z.enum(['pending', 'active', 'completed']),
  createdAt: z.string(),
})
export type RescueTask = z.infer<typeof RescueTask>

// ---- AED ----
export const AedDevice = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string(),
  lat: z.number(),
  lng: z.number(),
  distance: z.number(),
  status: z.enum(['available', 'in_use', 'maintenance']),
  lastCheck: z.string(),
  batteryLevel: z.number(),
})
export type AedDevice = z.infer<typeof AedDevice>

// ---- News ----
export const NewsItem = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(['video', 'photo', 'live', 'story', 'article', 'map']),
  category: z.enum(['recommend', 'video', 'nearby', 'volunteer']),
  time: z.string(),
  location: z.object({ name: z.string(), lat: z.number(), lng: z.number() }),
  tags: z.array(z.string()),
  isLive: z.boolean(),
  isUrgent: z.boolean(),
  body: z.string().optional(),
  imageUrl: z.string().optional(),
  videoUrl: z.string().optional(),
})
export type NewsItem = z.infer<typeof NewsItem>

// ---- Learn ----
export const CourseItem = z.object({
  id: z.string(),
  title: z.string(),
  category: z.string(),
  duration: z.string(),
  completed: z.boolean(),
  progress: z.number(),
  icon: z.string().optional(),
})
export type CourseItem = z.infer<typeof CourseItem>

// ---- Volunteer ----
export const VolunteerRank = z.object({
  id: z.string(),
  name: z.string(),
  avatar: z.string(),
  tier: UserTier,
  points: z.number(),
  rescueCount: z.number(),
  city: z.string(),
  rank: z.number(),
})
export type VolunteerRank = z.infer<typeof VolunteerRank>

// ---- Records ----
export const RescueRecord = z.object({
  id: z.string(),
  type: z.string(),
  date: z.string(),
  location: z.string(),
  role: z.string(),
  squad: z.array(z.string()),
  result: z.string(),
})
export type RescueRecord = z.infer<typeof RescueRecord>

// ---- Case ----
export const RescueCase = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  date: z.string(),
  location: z.string(),
  result: z.string(),
  volunteers: z.array(z.string()),
  body: z.string().optional(),
})
export type RescueCase = z.infer<typeof RescueCase>

// ---- Atlas ----
export const AtlasCard = z.object({
  id: z.string(),
  title: z.string(),
  category: z.string(),
  description: z.string(),
  steps: z.array(z.string()),
  icon: z.string().optional(),
  imageUrl: z.string().optional(),
})
export type AtlasCard = z.infer<typeof AtlasCard>

// ---- API Response ----
export const ApiResponse = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    code: z.number(),
    data: dataSchema.optional(),
    message: z.string(),
  })

export type ApiResponse<T> = {
  code: number
  data?: T
  message: string
}

export function success<T>(data: T, message = 'ok'): ApiResponse<T> {
  return { code: 0, data, message }
}

export function error(message: string, code = -1): ApiResponse<never> {
  return { code, message }
}
