const express = require('express');
const supertest = require('supertest');
const { getTracker, MockClient } = require('knex-mock-client');
const { router, urlTasks } = require('../../../routes');

jest.mock('../../../knexfile', () => ({
  test: { client: MockClient }
}));

const testTask = {
  site_id: 2,
  url: 'https://www.testUrl.co.uk/productName',
  style_index: 1,
  size: '7',
  shipping_speed_index: 2,
  billing_address_id: 3,
  shipping_address_id: 4,
  notification_email_address: 'jsmith@gmail.com'
};

const testTaskCreated = {
  id: 1,
  ...testTask,
  has_been_used: false,
  created_at: '2021-01-01T17:29:51.957Z',
  updated_at: '2021-01-01T17:29:51.957Z',
  is_deleted: false,
  auto_solve_captchas: true,
  product_code: 'PR0DUCT-100'
};

let request;
let tracker;

const app = express();
app.use(express.json());
app.use(router);

beforeEach(() => {
  tracker.on.select('select 1+1').responseOnce([]);
  tracker.on.select('* from "proxies"').responseOnce([]);
});

afterEach(() => {
  tracker.reset();
});

beforeAll(() => {
  request = supertest(app);
  tracker = getTracker();
});

afterAll(() => {
  // This needs to be imported here to use the mock connection
  jest.unmock('../../../knexfile');
  jest.resetModules();
  // eslint-disable-next-line global-require
  const knex = require('../../../config/knex');
  knex.destroy();
});

describe('GET /tasks', () => {
  it('should find multiple tasks', async () => {
    const testTasks = [
      testTaskCreated,
      {
        ...testTaskCreated,
        id: 2
      },
      {
        ...testTaskCreated,
        id: 3
      }
    ];
    tracker.on.select('tasks.*').response(testTasks);

    const response = await request.get(urlTasks);

    expect(response.status).toBe(200);
    expect(response.body.success).toBeTruthy();
    expect(response.body.message).toBe('Tasks successfully found');
    expect(response.body.data).toEqual(testTasks);
  });

  it('should find a single proxy', async () => {
    const testTasks = [testTaskCreated];
    tracker.on.select('tasks.*').response(testTasks);

    const response = await request.get(urlTasks);

    expect(response.status).toBe(200);
    expect(response.body.success).toBeTruthy();
    expect(response.body.message).toBe('Tasks successfully found');
    expect(response.body.data).toEqual(testTasks);
  });

  it('should find no tasks', async () => {
    const testTasks = [];
    tracker.on.select('tasks.*').response(testTasks);

    const response = await request.get(urlTasks);

    expect(response.status).toBe(200);
    expect(response.body.success).toBeTruthy();
    expect(response.body.message).toBe('Tasks not found');
    expect(response.body.data).toEqual(testTasks);
  });
});

describe('GET /tasks/:id', () => {
  it('should findOne single proxy', async () => {
    tracker.on.select('tasks.*').response(testTaskCreated);

    const response = await request.get(`${urlTasks}/1`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBeTruthy();
    expect(response.body.message).toBe('Task successfully found');
    expect(response.body.data).toEqual(testTaskCreated);
  });

  it('should not findOne proxy', async () => {
    tracker.on.select('tasks.*').response(undefined);

    const response = await request.get(`${urlTasks}/2`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBeTruthy();
    expect(response.body.message).toBe('Task not found');
    expect(response.body.data).toBeUndefined();
  });
});

describe('POST /tasks', () => {
  it('should create an proxy', async () => {
    tracker.on.insert('into "tasks"').response([testTaskCreated]);

    const response = await request.post(urlTasks).send(testTask);

    expect(response.status).toBe(200);
    expect(response.body.success).toBeTruthy();
    expect(response.body.message).toBe('Task successfully created');
    expect(response.body.data).toEqual(testTaskCreated);
  });

  it('should create no proxy when db insert fails', async () => {
    const testTaskWithError = {
      ...testTask,
      url: 'testWithTooManyCharacterstestWithTooManyCharacterstestWithTooManyCharacterstestWithTooManyCharacterstestWithTooManyCharacters'
        + 'testWithTooManyCharacterstestWithTooManyCharacterstestWithTooManyCharacterstestWithTooManyCharacterstestWithTooManyCharacters'
    };
    tracker.on.insert('into "tasks"').simulateError(new Error('DB insert failure'));

    const response = await request.post(urlTasks).send(testTaskWithError);

    expect(response.status).toBe(500);
    expect(response.body.success).toBeFalsy();
    expect(response.body.message).toContain('DB insert failure');
    expect(response.body.data).toEqual({});
  });

  it('should create no proxy when validation fails', async () => {
    const testTaskWithError = {
      ...testTask,
      site_id: null
    };
    tracker.on.insert('into "tasks"').simulateError(new Error('Validation failure'));

    const response = await request.post(urlTasks).send(testTaskWithError);

    expect(response.status).toBe(400);
    expect(response.body.success).toBeFalsy();
    expect(response.body.message).toBe('Validation Failed');
    expect(response.body.data.body[0].message).toEqual('"site_id" must be a number');
  });
});

describe('PATCH /tasks:id', () => {
  it('should update known address', async () => {
    tracker.on.update('"tasks"').response([testTaskCreated]);

    const response = await request.patch(`${urlTasks}/1`).send(testTask);

    expect(response.status).toBe(200);
    expect(response.body.success).toBeTruthy();
    expect(response.body.message).toBe('Task successfully updated');
    expect(response.body.data).toEqual(testTaskCreated);
  });

  it('should not update unknown proxy', async () => {
    tracker.on.update('"tasks"').response([]);

    const response = await request.patch(`${urlTasks}/1`).send(testTask);

    expect(response.status).toBe(200);
    expect(response.body.success).toBeTruthy();
    expect(response.body.message).toBe('Task not updated');
    expect(response.body.data).toBeUndefined();
  });
});

describe('DELETE /tasks:id', () => {
  it('should delete known proxy', async () => {
    const testTaskDeleted = {
      ...testTaskCreated,
      is_deleted: true
    };
    tracker.on.update('"tasks"').response([testTaskDeleted]);

    const response = await request.delete(`${urlTasks}/1`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBeTruthy();
    expect(response.body.message).toBe('Task successfully deleted');
    expect(response.body.data).toEqual(testTaskDeleted);
  });

  it('should not delete unknown proxy', async () => {
    tracker.on.update('"tasks"').response([]);

    const response = await request.delete(`${urlTasks}/1`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBeTruthy();
    expect(response.body.message).toBe('Task not deleted');
    expect(response.body.data).toBeUndefined();
  });
});
