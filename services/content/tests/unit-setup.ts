// Lightweight unit test setup: no DB/Redis
jest.mock('@/services/s3-upload');
jest.mock('@/services/elasticsearch');

export {};

