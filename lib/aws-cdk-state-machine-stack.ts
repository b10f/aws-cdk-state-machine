import * as cdk from 'aws-cdk-lib';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sns_subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import { Construct } from 'constructs';

export interface StateMachineStackProps extends cdk.StackProps {
    readonly topics: sns.Topic[];
}

export class AwsCdkStateMachineStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props: StateMachineStackProps) {
        super(scope, id, props);

        // In the future this state machine will do some work...
        const stateMachine = new sfn.StateMachine(this, 'StateMachine', {
            definition: new sfn.Pass(this, 'StartState')
        });

        // This Lambda function starts the state machine.
        const func = new lambda.Function(this, 'LambdaFunction', {
            runtime: lambda.Runtime.NODEJS_18_X,
            handler: 'handler',
            code: lambda.Code.fromAsset('./start-state-machine'),
            environment: {
                STATE_MACHINE_ARN: stateMachine.stateMachineArn
            }
        });
        stateMachine.grantStartExecution(func);

        const subscription = new sns_subscriptions.LambdaSubscription(func);
        for (const topic of props.topics) {
            topic.addSubscription(subscription);
        }
    }
}