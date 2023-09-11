const jsonSql = require('./lib');
const builder = jsonSql({
    separatedValues: false, // TODO: true
    namedValues: true,
    valuesPrefix: '$',
    dialect: 'postgresql',
    wrappedIdentifiers: true,
    indexedValues: true
});

let jsonQuery = {
    'with': [
        {
            name: 'users_having_admin_roles',
            select: {
                fields: [
                    { func: { name: 'array_agg', args: [{ field: 'role_template_id' }] } }
                ],
                table: 'azuread_directory_role',
                where: {
                    display_name: { $like: '%Administrator' }
                }
            }
        },
        {
            name: 'policy_with_mfa',
            select: {
                fields: [
                    'tenant_id',
                    { func: { name: 'count', args: [{ field: { table: 'p', name: '*' } }] } }
                ],
                table: 'azuread_conditional_access_policy',
                alias: 'p',
                join: [
                    {
                        type: 'cross',
                        table: 'users_having_admin_roles',
                        alias: 'a'
                    }
                ],
                where: {
                    'p.built_in_controls': { $jsonHasAll: { $array: 'mfa' } },
                    "(p.users->'includeRoles')::jsonb": { $jsonHasAny: { field: { name: 'rid', table: 'a' } } },
                    // TODO: (p.users -> 'includeRoles')::jsonb ?| (a.rid)
                    'p.users': { $jsonHasAny: { field: { table: 'a', name: 'rid' } } },
                    // TODO: jsonb_array_length(p.users -> 'excludeUsers') < 1
                    'a': { func: { name: 'jsonb_array_length', args: [{ field: { table: 'p', name: 'users' } }] } }
                },
                group: ['tenant_id']
            },
        },
        {
            name: 'tenant_list',
            select: {
                distinct: true,
                fields: [
                    'tenant_id',
                    '_ctx'
                ],
                table: 'azuread_user'
            }
        },
    ],
    type: 'select',
    select: {
        fields: [
            // {
            //     expression: {
            //         pattern: 'case when {condition} then {thenValue} else {elseValue} end',
            //         values: {

            //         }
            //     }
            // },
            /*
            TODO:
                case
                    when (select count from policy_with_mfa where tenant_id = t.tenant_id) > 0 then 'ok'
                    else 'alarm'
                end as status,
                case
                    when (select count from policy_with_mfa where tenant_id = t.tenant_id) > 0 then t.tenant_id || ' has MFA enabled for all users in administrative roles.'
                    else t.tenant_id || ' has MFA disabled for all users in administrative roles.'
                end as reason
                ${replace(local.common_dimensions_qualifier_sql, "QUALIFIER", "t.")}
            */
            { name: 'tenant_id', table: 't', alias: 'resource' }
        ],
        table: 'tenant_list',
        alias: 't'
    },
};

// jsonQuery = {
//     type: 'select',
//     fields: [
//         {
//             expression: {
//                 pattern: 'case when {condition} then {thenValue} else {elseValue} end',
//                 values: {
//                     condition: {
//                         select: {
//                             fields: ['a', 'b', 'c'],
//                             table: 'okay_table'
//                         },
//                         $gt: 0
//                     },
//                     thenValue: 'okay',
//                     elseValue: 'not okay'
//                 },
//                 alias: 'bruh'
//             }
//         },
//         { field: { name: 'a' } },
//         { field: { name: 'b' } }
//     ],
//     table: 'cool_table'
// };

const sql = builder.build(jsonQuery);

console.log(sql.query);
console.log(sql.values);
