-- Add 'vandalism' as a report category (additive enum evolution, mirrors schema.sql).
alter type report_category add value if not exists 'vandalism' before 'other';
