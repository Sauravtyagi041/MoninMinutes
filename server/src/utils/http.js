export const ok = (res, data, meta, status = 200) =>
  res.status(status).json(meta ? { data, meta } : { data });

export const pageParams = (query, defaults = { page: 1, pageSize: 10 }) => {
  const page = Math.max(1, parseInt(query.page, 10) || defaults.page);
  const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize, 10) || defaults.pageSize));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
};

export const pageMeta = ({ page, pageSize }, total) => ({
  page,
  pageSize,
  total,
  totalPages: Math.max(1, Math.ceil(total / pageSize)),
});
