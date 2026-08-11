/**
 * @file            main.cpp
 *
 * @date            2026-11-8
 *
 * @version         1.0.0
 *
 * @copyright       Copyright (c) 2026 privateMwb
 *                  All rights reserved.
 *                  https://github.com/privateMwb/FalconEye
 *
 * @attention       This source is released under the MIT license
 *                  SPDX-License-Identifier: MIT
 *                  <http://opensource.org/licenses/MIT>
 */

// clang-format off
#include <FalconHTTP/Core/Server.h>         // Server
#include <FalconHTTP/HTTP/HttpStatus.h>     // HttpStatus
#include <FalconHTTP/Middleware/Cors.h>     // Cors
#include <FalconHTTP/Middleware/Logger.h>   // Logger
#include <FalconHTTP/Middleware/Recovery.h> // Recovery
#include <FalconHTTP/Routing/Router.h>      // Router

#include <MiniDB/Core/Database.h>     // Database
#include <MiniDB/Common/Type.h>       // ColumnDef, ColumnType
#include <MiniDB/Engine/QueryEngine.h> // QueryEngine

#include <ArenaPro/Arena.h> // Arena
#include <JsonPro/Json.h>   // JsonPro::Json
// clang-format on

#include "Metrics.h"             // Metrics
#include "MetricsJson.h"         // metricsToJson()
#include "routes/ExampleRoutes.h" // registerExampleRoutes()

#include <iostream> // std::cerr, std::cout

/// @brief FalconEye server entry point. Wires Router, Database,
/// QueryEngine, Metrics, and the middleware chain together, then starts
/// the server.
int main() {
    // --- Data layer -----------------------------------------------------
    // Arena backing QueryEngine's per-call scratch allocations.
    // Cast makes the multiplication's result type explicit before the
    // widening conversion to size_t — 1024*1024 can't actually overflow
    // int here, but the cast documents intent instead of relying on
    // an implicit, unchecked widen.
    ArenaPro::Arena<> queryArena(static_cast<std::size_t>(1024) * 1024); // 1 MiB scratch space

    MiniDB::Core::Database db("falconeye");

    // Minimal schema + one seed row, just so /api/todos/:id has something
    // real to return during testing. "id" is intentionally not a schema
    // column -- Record::id is tracked separately from `data` and isn't
    // checked against `schema` by validate(). Replace with a real schema
    // once available.
    const MiniDB::Common::Status createStatus = db.createTable(
        "todos", {
                     MiniDB::Common::ColumnDef{"title", MiniDB::Common::ColumnType::STRING, false},
                     MiniDB::Common::ColumnDef{"done", MiniDB::Common::ColumnType::BOOL, false},
                 });
    if (createStatus != MiniDB::Common::Status::OK) {
        std::cerr << "Failed to create 'todos' table: "
                   << MiniDB::Common::statusToString(createStatus) << "\n";
        return 1;
    }

    MiniDB::Core::Table* todosTable = db.getTable("todos");
    if (todosTable == nullptr) {
        std::cerr << "'todos' table missing right after creation\n";
        return 1;
    }

    MiniDB::Core::Record seedRecord(/*id=*/1);
    seedRecord.setField("title", JsonPro::Json("Write the FalconEye README"));
    seedRecord.setField("done", JsonPro::Json(false));
    const MiniDB::Common::Status insertStatus = todosTable->insertRecord(seedRecord);
    if (insertStatus != MiniDB::Common::Status::OK) {
        std::cerr << "Failed to seed 'todos' row: "
                   << MiniDB::Common::statusToString(insertStatus) << "\n";
        return 1;
    }

    MiniDB::Engine::QueryEngine queryEngine(queryArena);

    // --- Routing + metrics -----------------------------------------------
    FalconHTTP::Routing::Router router;
    registerExampleRoutes(router, db, queryEngine);

    Metrics metrics(router, 50); // ring buffer capacity 50

    // Real /api/metrics endpoint. Registered on the same Router that
    // Metrics itself reads from -- fine, since this route returns
    // Metrics's own recorded data, not routing metadata.
    router.get("/api/metrics",
               [&metrics](const FalconHTTP::HTTP::HttpRequest&, FalconHTTP::HTTP::HttpResponse& response) {
                   response.setStatus(FalconHTTP::HTTP::HttpStatus::Ok);
                   response.setJson(metricsToJson(metrics));
               });

    // --- Server + middleware chain ----------------------------------------
    FalconHTTP::Core::Server server(router, /*threadCount=*/4);

    server.use(FalconHTTP::Middleware::Recovery{});
    server.use(FalconHTTP::Middleware::Logger{});
    server.use(FalconHTTP::Middleware::Cors{"http://localhost:5173"});
    server.use(metrics); // LAST -- captures the full request, including the handler

    if (!server.start(8080)) {
        std::cerr << "Failed to start server\n";
        return 1;
    }

    server.run();
    return 0;
}
