// Generated schema
// DO NOT EDIT - run 'dali-orm pull' to regenerate

import { record } from 'dali-orm/sdk/schema/column/record';
import { array, bool, datetime, string } from 'dali-orm/sdk/schema/column/simple-builders';
import { defineTable } from 'dali-orm/sdk/table';

export const articleSchema = defineTable('article', {
  article: record('user'),
  content: string('content'),
  created_at: datetime('created_at').default('time::now()'),
  owner: record('user'),
  published_at: datetime('published_at').optional(),
  status: string('status'),
  tags: array('tags').optional(),
  'tags.*': string('tags.*'),
  title: string('title'),
  updated_at: datetime('updated_at').default('time::now()'),
});

export const article_shareSchema = defineTable('article_share', {
  created_at: datetime('created_at').default('time::now()'),
  role: string('role').default('viewer'),
});

export const publishedSchema = defineTable('published', {
  published_at: datetime('published_at'),
});

export const todoSchema = defineTable('todo', {
  completed: bool('completed').default(false),
  completed_at: datetime('completed_at').optional().default('time::now()'),
  created_at: datetime('created_at'),
  description: string('description').optional(),
  owner: record('user'),
  tags: array('tags').optional(),
  'tags.*': string('tags.*'),
  title: string('title'),
  todo: record('user'),
});

export const todo_shareSchema = defineTable('todo_share', {
  created_at: datetime('created_at').default('time::now()'),
  role: string('role').default('viewer'),
});

export const userSchema = defineTable('user', {
  created_at: datetime('created_at').default('time::now()'),
  email: string('email'),
  name: string('name'),
  password: string('password'),
});

export const wroteSchema = defineTable('wrote', {
  created_at: datetime('created_at').default('time::now()'),
});

export default {
  article: articleSchema,
  article_share: article_shareSchema,
  published: publishedSchema,
  todo: todoSchema,
  todo_share: todo_shareSchema,
  user: userSchema,
  wrote: wroteSchema,
};
