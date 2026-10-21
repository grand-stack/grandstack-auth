/* eslint-disable */
import * as types from './graphql';
import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
    "\n  query DemoMovie($title: String!) {\n    movies(where: { title: { eq: $title } }) {\n      title\n      released\n      rating\n      tagline\n      genres { name }\n      reviews(sort: [{ createdAt: DESC }]) {\n        id\n        rating\n        text\n        createdAt\n        author { sub name }\n      }\n    }\n  }\n": typeof types.DemoMovieDocument,
    "\n  mutation DemoCreateReview($movie: String!, $rating: Int!, $text: String) {\n    createReview(movie: $movie, rating: $rating, text: $text) { id }\n  }\n": typeof types.DemoCreateReviewDocument,
    "\n  mutation DemoUpdateReview($id: ID!, $text: String, $rating: Int) {\n    updateReviews(where: { id: { eq: $id } }, update: { text: { set: $text }, rating: { set: $rating } }) { reviews { id } }\n  }\n": typeof types.DemoUpdateReviewDocument,
    "\n  mutation DemoDeleteReview($id: ID!) {\n    deleteReviews(where: { id: { eq: $id } }) { nodesDeleted }\n  }\n": typeof types.DemoDeleteReviewDocument,
    "\n  query DemoMovies($search: String!) {\n    movies(where: { title: { contains: $search } }, sort: [{ rating: DESC }], limit: 24) {\n      title\n      released\n      rating\n      genres { name }\n      reviewsConnection { totalCount }\n    }\n  }\n": typeof types.DemoMoviesDocument,
};
const documents: Documents = {
    "\n  query DemoMovie($title: String!) {\n    movies(where: { title: { eq: $title } }) {\n      title\n      released\n      rating\n      tagline\n      genres { name }\n      reviews(sort: [{ createdAt: DESC }]) {\n        id\n        rating\n        text\n        createdAt\n        author { sub name }\n      }\n    }\n  }\n": types.DemoMovieDocument,
    "\n  mutation DemoCreateReview($movie: String!, $rating: Int!, $text: String) {\n    createReview(movie: $movie, rating: $rating, text: $text) { id }\n  }\n": types.DemoCreateReviewDocument,
    "\n  mutation DemoUpdateReview($id: ID!, $text: String, $rating: Int) {\n    updateReviews(where: { id: { eq: $id } }, update: { text: { set: $text }, rating: { set: $rating } }) { reviews { id } }\n  }\n": types.DemoUpdateReviewDocument,
    "\n  mutation DemoDeleteReview($id: ID!) {\n    deleteReviews(where: { id: { eq: $id } }) { nodesDeleted }\n  }\n": types.DemoDeleteReviewDocument,
    "\n  query DemoMovies($search: String!) {\n    movies(where: { title: { contains: $search } }, sort: [{ rating: DESC }], limit: 24) {\n      title\n      released\n      rating\n      genres { name }\n      reviewsConnection { totalCount }\n    }\n  }\n": types.DemoMoviesDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 *
 *
 * @example
 * ```ts
 * const query = graphql(`query GetUser($id: ID!) { user(id: $id) { name } }`);
 * ```
 *
 * The query argument is unknown!
 * Please regenerate the types.
 */
export function graphql(source: string): unknown;

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query DemoMovie($title: String!) {\n    movies(where: { title: { eq: $title } }) {\n      title\n      released\n      rating\n      tagline\n      genres { name }\n      reviews(sort: [{ createdAt: DESC }]) {\n        id\n        rating\n        text\n        createdAt\n        author { sub name }\n      }\n    }\n  }\n"): (typeof documents)["\n  query DemoMovie($title: String!) {\n    movies(where: { title: { eq: $title } }) {\n      title\n      released\n      rating\n      tagline\n      genres { name }\n      reviews(sort: [{ createdAt: DESC }]) {\n        id\n        rating\n        text\n        createdAt\n        author { sub name }\n      }\n    }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DemoCreateReview($movie: String!, $rating: Int!, $text: String) {\n    createReview(movie: $movie, rating: $rating, text: $text) { id }\n  }\n"): (typeof documents)["\n  mutation DemoCreateReview($movie: String!, $rating: Int!, $text: String) {\n    createReview(movie: $movie, rating: $rating, text: $text) { id }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DemoUpdateReview($id: ID!, $text: String, $rating: Int) {\n    updateReviews(where: { id: { eq: $id } }, update: { text: { set: $text }, rating: { set: $rating } }) { reviews { id } }\n  }\n"): (typeof documents)["\n  mutation DemoUpdateReview($id: ID!, $text: String, $rating: Int) {\n    updateReviews(where: { id: { eq: $id } }, update: { text: { set: $text }, rating: { set: $rating } }) { reviews { id } }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  mutation DemoDeleteReview($id: ID!) {\n    deleteReviews(where: { id: { eq: $id } }) { nodesDeleted }\n  }\n"): (typeof documents)["\n  mutation DemoDeleteReview($id: ID!) {\n    deleteReviews(where: { id: { eq: $id } }) { nodesDeleted }\n  }\n"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query DemoMovies($search: String!) {\n    movies(where: { title: { contains: $search } }, sort: [{ rating: DESC }], limit: 24) {\n      title\n      released\n      rating\n      genres { name }\n      reviewsConnection { totalCount }\n    }\n  }\n"): (typeof documents)["\n  query DemoMovies($search: String!) {\n    movies(where: { title: { contains: $search } }, sort: [{ rating: DESC }], limit: 24) {\n      title\n      released\n      rating\n      genres { name }\n      reviewsConnection { totalCount }\n    }\n  }\n"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> = TDocumentNode extends DocumentNode<  infer TType,  any>  ? TType  : never;