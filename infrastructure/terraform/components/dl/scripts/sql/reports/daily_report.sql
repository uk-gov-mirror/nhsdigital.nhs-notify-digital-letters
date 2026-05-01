WITH vars AS (
    SELECT CAST(? AS DATE) AS dt,
        ? AS senderid
),
"translated_events" AS (
    SELECT e.messagereference,
        e.time,
        CASE
            WHEN e.type LIKE '%.item.dequeued.%'
            OR e.type LIKE '%.queue.digital.letter.read.%'
            OR e.type LIKE '%.pdm.resource.submission.rejected.%'
            OR e.type LIKE '%.pdm.resource.retries.exceeded.%'
            OR e.type LIKE '%.messages.request.rejected.%' THEN 'Digital'
            WHEN e.type LIKE '%.print.letter.transitioned.%'
            OR e.type LIKE '%.print.file.quarantined.%'
            OR e.type LIKE '%.print.invalid.attachment.received.%' THEN 'Print' ELSE NULL
        END as communicationtype,
        CASE
            WHEN e.type LIKE '%.item.dequeued.%' THEN 'Unread'
            WHEN e.type LIKE '%.queue.digital.letter.read.%' THEN 'Read'
            WHEN e.type LIKE '%.pdm.resource.submission.rejected.%' THEN 'Failed'
            WHEN e.type LIKE '%.pdm.resource.retries.exceeded.%' THEN 'Failed'
            WHEN e.type LIKE '%.messages.request.rejected.%' THEN 'Failed'
            WHEN e.type LIKE '%.print.file.quarantined.%' THEN 'Failed'
            WHEN e.type LIKE '%.print.invalid.attachment.received.%' THEN 'Failed'
            WHEN e.letterstatus = 'RETURNED' THEN 'Returned'
            WHEN e.letterstatus = 'FAILED' THEN 'Failed'
            WHEN e.letterstatus = 'DISPATCHED' THEN 'Dispatched'
            WHEN e.letterstatus = 'REJECTED' THEN 'Rejected' ELSE NULL
        END as status,
        e.reasoncode,
        COALESCE(
            CASE WHEN e.type LIKE '%.messages.request.rejected.%' THEN e.reasontext END,
            fcl.description,
            e.reasontext,
            e.reasoncode
        ) as reasontext
    FROM event_record e
        CROSS JOIN vars v
        LEFT JOIN failure_code_lookup fcl ON e.reasoncode = fcl.code
    WHERE e.senderid = v.senderid
        AND e.__year = year(v.dt)
        AND e.__month = month(v.dt)
        AND e.__day = day(v.dt)
),
"ordered_events" AS (
    SELECT ROW_NUMBER() OVER (
            PARTITION BY te.messagereference, te.communicationtype
            ORDER BY te.time DESC,
                CASE
                    -- Digital Priority Order
                    WHEN te.communicationtype = 'Digital' AND te.status = 'Failed' THEN 3
                    WHEN te.status = 'Read' THEN 2
                    WHEN te.status = 'Unread' THEN 1
                    -- Print Priority Order
                    WHEN te.status = 'Returned' THEN 4
                    WHEN te.communicationtype = 'Print' AND te.status = 'Failed' THEN 3
                    WHEN te.status = 'Dispatched' THEN 2
                    WHEN te.status = 'Rejected' THEN 1 ELSE 0
                END DESC
        ) AS "row_number",
        te.messagereference,
        te.time,
        te.communicationtype,
        te.status,
        te.reasoncode,
        te.reasontext
    FROM "translated_events" AS te
    WHERE te.status IS NOT NULL
        AND te.communicationtype IS NOT NULL
)
SELECT oe.messagereference as "Message Reference",
    oe.time as "Time",
    oe.communicationtype as "Communication Type",
    oe.status as "Status",
    oe.reasoncode as "Reason Code",
    oe.reasontext as "Reason"
FROM "ordered_events" AS oe
WHERE oe.row_number = 1
