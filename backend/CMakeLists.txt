# ============================================================
# CMakeLists.txt — FalconEye server
# ============================================================
#
# Top-level build file for backend/. Pulls in the two untouched
# upstream submodules (falconhttp/, minidb/) via add_subdirectory,
# then builds our own executable against them.
#
# NOTE: both falconhttp/ and minidb/ vendor their own independent
# copies of shared submodules (VectorPro, HashMapPro, ArenaPro, ...)
# and compile any non-header-only ones directly into their own static
# library. If linking below fails with "multiple definition of ...",
# that's why — see the project notes on this. Try building first;
# only chase that fix if the linker actually complains.
# ============================================================

cmake_minimum_required(VERSION 3.20)

project(
    FalconEye
    VERSION 0.1.0
    LANGUAGES CXX
)

set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR})

# ============================================================================
# Submodules (untouched, upstream — see .gitmodules)
# ============================================================================

# Both examples/tests/benchmarks/regression suites default ON in each
# submodule's own CMakeLists.txt. We don't need any of that here, so
# turn them off before add_subdirectory() picks up their defaults.
set(BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(BUILD_BENCHMARKS OFF CACHE BOOL "" FORCE)
set(BUILD_REGRESSION OFF CACHE BOOL "" FORCE)
set(BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)

add_subdirectory(external/falconhttp)
add_subdirectory(external/minidb)

# ============================================================================
# FalconEye server executable
# ============================================================================

add_executable(
    falconeye_server
    src/main.cpp
)

target_include_directories(
    falconeye_server
    PRIVATE
        include
        src
)

# Target names are the bare project names (FalconHTTP, MiniDB) — both
# submodules' CMakeLists.txt only namespace-alias under NAMESPACE::
# for their *installed* package export; in-tree via add_subdirectory,
# the plain names apply.
target_link_libraries(
    falconeye_server
    PRIVATE
        FalconHTTP
        MiniDB
)

# ============================================================================
# Tests
# ============================================================================

# Named FALCONEYE_BUILD_TESTS, not BUILD_TESTS: the latter is force-set OFF
# above for the submodules.
option(FALCONEYE_BUILD_TESTS "Build the FalconEye test suite" ON)

if(FALCONEYE_BUILD_TESTS)
    file(GLOB_RECURSE TEST_SOURCES CONFIGURE_DEPENDS
        "${CMAKE_CURRENT_SOURCE_DIR}/tests/*.cpp"
    )

    add_executable(falconeye_tests ${TEST_SOURCES})

    target_include_directories(
        falconeye_tests
        PRIVATE
            include
            ${CMAKE_CURRENT_SOURCE_DIR}/tests
    )

    target_link_libraries(
        falconeye_tests
        PRIVATE
            FalconHTTP
            MiniDB
    )
endif()

# ============================================================================
# Fuzz harnesses (built by ClusterFuzzLite; see .clusterfuzzlite/)
# ============================================================================

# OFF by default: the harnesses need a fuzzing engine to link against, which
# ClusterFuzzLite provides through $LIB_FUZZING_ENGINE. Every
# fuzz/fuzz_<name>.cpp becomes its own executable, no edit needed here.
option(FALCONEYE_BUILD_FUZZERS "Build the libFuzzer harnesses" OFF)

if(FALCONEYE_BUILD_FUZZERS)
    file(GLOB FUZZ_SOURCES CONFIGURE_DEPENDS
        "${CMAKE_CURRENT_SOURCE_DIR}/fuzz/fuzz_*.cpp"
    )

    foreach(fuzz_source ${FUZZ_SOURCES})
        get_filename_component(fuzz_name ${fuzz_source} NAME_WE)

        add_executable(${fuzz_name} ${fuzz_source})

        target_include_directories(${fuzz_name} PRIVATE include)

        target_link_libraries(
            ${fuzz_name}
            PRIVATE
                FalconHTTP
                MiniDB
                $ENV{LIB_FUZZING_ENGINE}
        )
    endforeach()
endif()
